const WORKER_URL = "https://links-hub-api.prlg626.workers.dev";

const PASS_KEY = "hub_pass_v1";

function getSavedPass() {
  return sessionStorage.getItem(PASS_KEY) || "";
}

function setSavedPass(p) {
  sessionStorage.setItem(PASS_KEY, p || "");
}

let allItems = [];

function setStatus(msg) {
  const el = document.getElementById('statusBar');
  if (!el) return;
  el.textContent = msg || '';
}

function safeText(str) {
  return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadItems() {
  try {
    const response = await fetch('items.json?ts=' + Date.now(), { cache: 'no-store' });
    const data = await response.json();

    allItems = (data.items || []).map(x => ({
      id: x.id,
      type: x.type,
      title: x.title,
      url: x.url,
      note: x.note || '',
      category: x.category || 'General',
      date: x.date || '',
      bucket_key: x.bucket_key || ''
    }));

    renderItems(allItems);
  } catch (e) {
    const container = document.getElementById('linksContainer');
    if (container) container.innerHTML = `<div class="empty">No se pudo cargar items.json</div>`;
  }
}

function renderItems(items) {
  const container = document.getElementById('linksContainer');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `<div class="empty">Sin elementos</div>`;
    return;
  }

  container.innerHTML = '';

  items.forEach((it) => {
    const card = document.createElement('div');
    card.className = 'card';

    const openLabel = (it.type === 'pdf') ? 'Abrir PDF' : 'Abrir';
    const typeBadge = (it.type === 'pdf') ? 'PDF' : (it.category || 'Link');

    card.innerHTML = `
      <div class="topline">
        <span class="badge">${safeText(typeBadge)}</span>
        <span class="meta">${safeText(it.date || '')}</span>
      </div>
      <h3>${safeText(it.title || 'Sin título')}</h3>
      <p class="${it.note ? '' : 'muted'}">${safeText(it.note || 'Sin descripción')}</p>
      <div class="actions">
        <a class="btn" href="${safeText(it.url)}" target="_blank" rel="noopener noreferrer">${openLabel}</a>
        <button class="ghost" type="button" data-copy="${safeText(it.url)}">Copiar</button>
        <button class="ghost" type="button" data-del="${safeText(it.id)}">Eliminar</button>
      </div>
    `;

    container.appendChild(card);
  });

  container.querySelectorAll('button[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const u = btn.getAttribute('data-copy') || '';
      try {
        await navigator.clipboard.writeText(u);
        setStatus('Copiado.');
      } catch {
        setStatus('No se pudo copiar.');
      }
    });
  });

  container.querySelectorAll('button[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del') || '';
      const pass = prompt('Clave para eliminar');
      if (!pass) return;

      setStatus('Eliminando...');
      const res = await fetch(WORKER_URL + "/delete-item", {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, password: pass })
      });

      const t = await res.text();
      if (!res.ok) { setStatus('Error: ' + t); return; }

      setStatus('Listo. Actualizando...');
      setTimeout(() => loadItems(), 4000);
    });
  });
}

function openModal() {
  const m = document.getElementById('modal');
  if (m) m.classList.remove('hidden');
}

function closeModal() {
  const m = document.getElementById('modal');
  if (m) m.classList.add('hidden');
}

async function sendAdd() {
  try {
    const title = (document.getElementById('fTitle')?.value || '').trim();
    const url = (document.getElementById('fUrl')?.value || '').trim();
    const category = (document.getElementById('fCat')?.value || '').trim();
    const note = (document.getElementById('fNote')?.value || '').trim();
    const password = (document.getElementById('fPass')?.value || '');
    const pdf = document.getElementById('fPdf')?.files?.[0];

    if (!password) { setStatus('Falta la clave.'); return; }

    setStatus('Enviando...');

    if (pdf) {
      const fd = new FormData();
      fd.append('file', pdf);
      fd.append('title', title || 'PDF');
      fd.append('category', category || 'PDF');
      fd.append('note', note);
      fd.append('password', password);

      const res = await fetch(WORKER_URL + "/upload-pdf", { method: 'POST', body: fd });
      const text = await res.text();

      if (!res.ok) {
        setStatus('Error PDF: ' + text);
        return;
      }
    } else {
      if (!url || !url.startsWith('http')) { setStatus('URL inválida.'); return; }

      const res = await fetch(WORKER_URL + "/add-link", {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title || 'Sin título', url, category, note, password })
      });

      const text = await res.text();
      if (!res.ok) { setStatus('Error Link: ' + text); return; }
    }

    setStatus('Listo. En ~1 minuto aparecerá (cuando Actions termine).');
    closeModal();

    ['fTitle','fUrl','fCat','fNote','fPass'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const f = document.getElementById('fPdf');
    if (f) f.value = '';

    setTimeout(() => loadItems(), 70000);
  } catch (e) {
    console.error(e);
    setStatus('Error inesperado. Revisa consola.');
  }
}

async function loadNotes() {
  try {
    const res = await fetch(WORKER_URL + "/notes", { method: "GET" });
    const j = await res.json();
    const box = document.getElementById('notesBox');
    if (box) box.value = j.text || '';
    const st = document.getElementById('notesStatus');
    if (st) st.textContent = '';
  } catch {}
}

let notesTimer = null;

async function saveNotes(force) {
  const box = document.getElementById('notesBox');
  const st = document.getElementById('notesStatus');
  const text = box ? box.value : '';

  if (force) {
    const pass = prompt('Clave para guardar notas');
    if (!pass) return;
    setSavedPass(pass);
  }

  const pass2 = getSavedPass();
  if (!pass2) {
    if (st) st.textContent = 'Pulsa Guardar para ingresar clave.';
    return;
  }

  try {
    if (st) st.textContent = 'Guardando...';
    const res = await fetch(WORKER_URL + "/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, password: pass2 })
    });

    const t = await res.text();
    if (!res.ok) {
      if (st) st.textContent = 'Error guardando: ' + t;
      return;
    }

    if (st) st.textContent = 'Guardado';
  } catch {
    if (st) st.textContent = 'Error de red';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadItems();
  loadNotes();

  if (!getSavedPass()) {
    const st = document.getElementById('notesStatus');
    if (st) st.textContent = 'Pulsa Guardar para ingresar clave.';
  }

  document.getElementById('openAdd')?.addEventListener('click', () => { setStatus(''); openModal(); });
  document.getElementById('closeAdd')?.addEventListener('click', closeModal);
  document.getElementById('cancelAdd')?.addEventListener('click', closeModal);
  document.getElementById('sendAdd')?.addEventListener('click', sendAdd);

  const search = document.getElementById('searchInput');
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase().trim();
      const filtered = allItems.filter(x =>
        (x.title || '').toLowerCase().includes(q) ||
        (x.note || '').toLowerCase().includes(q) ||
        (x.category || '').toLowerCase().includes(q) ||
        (x.type || '').toLowerCase().includes(q)
      );
      renderItems(filtered);
    });
  }

  const box = document.getElementById('notesBox');
  const btn = document.getElementById('saveNotes');

  if (btn) btn.addEventListener('click', () => saveNotes(true));

  if (box) {
    box.addEventListener('input', () => {
      const st = document.getElementById('notesStatus');
      if (st) st.textContent = 'Escribiendo...';
      clearTimeout(notesTimer);
      notesTimer = setTimeout(() => saveNotes(false), 1200);
    });
  }
});
