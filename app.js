const WORKER_URL = "https://links-hub-api.prlg626.workers.dev";
const REPO_FULL_NAME = "prlg626-jpg/links-hub";
const PASS_KEY = "hub_pass_v1";

let allItems = [];
let editingId = '';
let notesTimer = null;

function getSavedPass() {
  try {
    return sessionStorage.getItem(PASS_KEY) || "";
  } catch {
    return "";
  }
}

function setSavedPass(p) {
  try {
    sessionStorage.setItem(PASS_KEY, p || "");
  } catch {}
}

function setStatus(msg) {
  const el = document.getElementById('statusBar');
  if (!el) return;
  el.textContent = msg || '';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function getItem(id) {
  return allItems.find(x => x.id === id);
}

async function workerRequest(path, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(WORKER_URL + path, {
      ...options,
      signal: controller.signal
    });
    const text = await res.text();
    return { res, text };
  } finally {
    clearTimeout(timer);
  }
}

function issueBody(fields) {
  return Object.entries(fields)
    .map(([key, value]) => `### ${key}\n${String(value ?? '')}`)
    .join('\n\n');
}

function openOwnerIssue(title, fields) {
  const url = new URL(`https://github.com/${REPO_FULL_NAME}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', issueBody(fields));
  window.location.assign(url.toString());
}

function shouldOfferFallback(status) {
  return status === 404 || status === 405 || status === 408 || status === 429 || status >= 500;
}

function offerGitHubFallback(actionLabel, title, fields) {
  const ok = confirm(
    `El servicio automático de Cloudflare no respondió correctamente. ` +
    `¿Quieres completar ${actionLabel} desde GitHub? La solicitud quedará prellenada; solo tendrás que enviarla.`
  );
  if (!ok) return false;
  openOwnerIssue(title, fields);
  return true;
}

function scheduleRefresh() {
  setTimeout(() => loadItems(), 4500);
  setTimeout(() => loadItems(), 15000);
}

async function loadItems() {
  try {
    const response = await fetch('items.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
    console.error('loadItems', e);
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
        <span class="badge">${escapeHtml(typeBadge)}</span>
        <span class="meta">${escapeHtml(it.date || '')}</span>
      </div>
      <h3>${escapeHtml(it.title || 'Sin título')}</h3>
      <p class="${it.note ? '' : 'muted'}">${escapeHtml(it.note || 'Sin descripción')}</p>
      <div class="actions">
        <a class="btn" data-open target="_blank" rel="noopener noreferrer">${openLabel}</a>
        <button class="ghost" type="button" data-copy>Copiar</button>
        <button class="ghost" type="button" data-edit>Editar</button>
        <button class="ghost" type="button" data-del>Eliminar</button>
      </div>
    `;

    const open = card.querySelector('[data-open]');
    if (open) open.href = it.url || '#';

    card.querySelector('[data-copy]')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(it.url || '');
        setStatus('Copiado.');
      } catch {
        setStatus('No se pudo copiar.');
      }
    });

    card.querySelector('[data-edit]')?.addEventListener('click', () => openEditModal(it.id));
    card.querySelector('[data-del]')?.addEventListener('click', () => deleteItem(it.id));

    container.appendChild(card);
  });
}

function resetForm() {
  ['fTitle','fUrl','fCat','fNote','fPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const file = document.getElementById('fPdf');
  if (file) file.value = '';
}

function openModal() {
  document.getElementById('modal')?.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal')?.classList.add('hidden');
  editingId = '';
}

function openAddModal() {
  editingId = '';
  resetForm();
  const title = document.getElementById('modalTitle');
  const send = document.getElementById('sendAdd');
  const pdfWrap = document.getElementById('pdfFieldWrap');
  if (title) title.textContent = 'Agregar';
  if (send) send.textContent = 'Guardar';
  if (pdfWrap) pdfWrap.classList.remove('hidden');
  setStatus('');
  openModal();
}

function openEditModal(id) {
  const item = getItem(id);
  if (!item) {
    setStatus('No encontré el elemento para editar.');
    return;
  }

  editingId = id;
  const title = document.getElementById('modalTitle');
  const send = document.getElementById('sendAdd');
  const pdfWrap = document.getElementById('pdfFieldWrap');
  if (title) title.textContent = 'Editar';
  if (send) send.textContent = 'Guardar cambios';
  if (pdfWrap) pdfWrap.classList.add('hidden');

  const fTitle = document.getElementById('fTitle');
  const fUrl = document.getElementById('fUrl');
  const fCat = document.getElementById('fCat');
  const fNote = document.getElementById('fNote');
  const fPass = document.getElementById('fPass');

  if (fTitle) fTitle.value = item.title || '';
  if (fUrl) fUrl.value = item.url || '';
  if (fCat) fCat.value = item.category || '';
  if (fNote) fNote.value = item.note || '';
  if (fPass) fPass.value = '';

  setStatus('');
  openModal();
}

async function deleteItem(id) {
  const item = getItem(id);
  if (!item) return;
  if (!confirm(`¿Eliminar “${item.title || 'este elemento'}”?`)) return;

  const password = prompt('Clave para eliminar');
  if (!password) return;

  setStatus('Eliminando...');

  try {
    const { res, text } = await workerRequest('/delete-item', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, password })
    });

    if (res.ok) {
      setStatus('Solicitud de eliminación enviada. Actualizando...');
      scheduleRefresh();
      return;
    }

    if (res.status === 401 || res.status === 403) {
      setStatus('Clave incorrecta o acceso rechazado.');
      return;
    }

    if (shouldOfferFallback(res.status)) {
      if (offerGitHubFallback('la eliminación', `[Hub Delete] ${id}`, {
        action: 'delete-item',
        id
      })) return;
    }

    setStatus(`No se pudo eliminar (${res.status}): ${text || 'sin detalle'}`);
  } catch (e) {
    console.error('deleteItem', e);
    if (offerGitHubFallback('la eliminación', `[Hub Delete] ${id}`, {
      action: 'delete-item',
      id
    })) return;
    setStatus('No se pudo conectar con el servicio de eliminación.');
  }
}

async function sendForm() {
  const title = (document.getElementById('fTitle')?.value || '').trim();
  const url = (document.getElementById('fUrl')?.value || '').trim();
  const category = (document.getElementById('fCat')?.value || '').trim();
  const note = (document.getElementById('fNote')?.value || '').trim();
  const password = document.getElementById('fPass')?.value || '';
  const pdf = document.getElementById('fPdf')?.files?.[0];

  if (!password) {
    setStatus('Falta la clave.');
    return;
  }

  if (editingId) {
    await sendEdit({ id: editingId, title, url, category, note, password });
    return;
  }

  await sendAdd({ title, url, category, note, password, pdf });
}

async function sendEdit({ id, title, url, category, note, password }) {
  if (!url || !/^https?:\/\//i.test(url)) {
    setStatus('URL inválida.');
    return;
  }

  setStatus('Guardando cambios...');

  const payload = {
    id,
    title: title || 'Sin título',
    url,
    category: category || 'General',
    note,
    password
  };

  try {
    const { res, text } = await workerRequest('/edit-item', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setStatus('Cambios enviados. Actualizando...');
      closeModal();
      scheduleRefresh();
      return;
    }

    if (res.status === 401 || res.status === 403) {
      setStatus('Clave incorrecta o acceso rechazado.');
      return;
    }

    if (shouldOfferFallback(res.status)) {
      offerGitHubFallback('la edición', `[Hub Edit] ${payload.title}`, {
        action: 'edit-item',
        id,
        title: payload.title,
        url: payload.url,
        category: payload.category,
        note: payload.note
      });
      return;
    }

    setStatus(`No se pudo editar (${res.status}): ${text || 'sin detalle'}`);
  } catch (e) {
    console.error('sendEdit', e);
    if (offerGitHubFallback('la edición', `[Hub Edit] ${payload.title}`, {
      action: 'edit-item',
      id,
      title: payload.title,
      url: payload.url,
      category: payload.category,
      note: payload.note
    })) return;
    setStatus('No se pudo conectar con el servicio de edición.');
  }
}

async function sendAdd({ title, url, category, note, password, pdf }) {
  setStatus('Enviando...');

  if (pdf) {
    try {
      const fd = new FormData();
      fd.append('file', pdf);
      fd.append('title', title || 'PDF');
      fd.append('category', category || 'PDF');
      fd.append('note', note);
      fd.append('password', password);

      const { res, text } = await workerRequest('/upload-pdf', {
        method: 'POST',
        body: fd
      }, 30000);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setStatus('Clave incorrecta o acceso rechazado.');
        } else {
          setStatus(`No se pudo subir el PDF (${res.status}): ${text || 'sin detalle'}`);
        }
        return;
      }

      setStatus('PDF enviado. Actualizando...');
      closeModal();
      resetForm();
      scheduleRefresh();
      return;
    } catch (e) {
      console.error('uploadPdf', e);
      setStatus('No se pudo conectar con Cloudflare para subir el PDF. Esta operación sí depende del Worker.');
      return;
    }
  }

  if (!url || !/^https?:\/\//i.test(url)) {
    setStatus('URL inválida.');
    return;
  }

  const payload = {
    title: title || 'Sin título',
    url,
    category: category || 'General',
    note,
    password
  };

  try {
    const { res, text } = await workerRequest('/add-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setStatus('Link enviado. Actualizando...');
      closeModal();
      resetForm();
      scheduleRefresh();
      return;
    }

    if (res.status === 401 || res.status === 403) {
      setStatus('Clave incorrecta o acceso rechazado.');
      return;
    }

    if (shouldOfferFallback(res.status)) {
      offerGitHubFallback('la creación del link', `[Hub Add] ${payload.title}`, {
        action: 'add-link',
        title: payload.title,
        url: payload.url,
        category: payload.category,
        note: payload.note
      });
      return;
    }

    setStatus(`No se pudo agregar (${res.status}): ${text || 'sin detalle'}`);
  } catch (e) {
    console.error('sendAdd', e);
    if (offerGitHubFallback('la creación del link', `[Hub Add] ${payload.title}`, {
      action: 'add-link',
      title: payload.title,
      url: payload.url,
      category: payload.category,
      note: payload.note
    })) return;
    setStatus('No se pudo conectar con el servicio para agregar el link.');
  }
}

async function loadNotes() {
  const st = document.getElementById('notesStatus');
  try {
    const { res, text } = await workerRequest('/notes', { method: 'GET' }, 8000);
    if (!res.ok) {
      if (st) st.textContent = `Notas no disponibles (${res.status}).`;
      return;
    }
    const j = JSON.parse(text || '{}');
    const box = document.getElementById('notesBox');
    if (box) box.value = j.text || '';
    if (st) st.textContent = getSavedPass() ? '' : 'Pulsa Guardar para ingresar clave.';
  } catch (e) {
    console.error('loadNotes', e);
    if (st) st.textContent = 'Notas no disponibles: no hay conexión con Cloudflare.';
  }
}

async function saveNotes(force) {
  const box = document.getElementById('notesBox');
  const st = document.getElementById('notesStatus');
  const text = box ? box.value : '';

  if (force) {
    const pass = prompt('Clave para guardar notas');
    if (!pass) return;
    setSavedPass(pass);
  }

  const password = getSavedPass();
  if (!password) {
    if (st) st.textContent = 'Pulsa Guardar para ingresar clave.';
    return;
  }

  try {
    if (st) st.textContent = 'Guardando...';
    const { res, text: responseText } = await workerRequest('/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, password })
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) setSavedPass('');
      if (st) st.textContent = `Error guardando (${res.status}): ${responseText || 'sin detalle'}`;
      return;
    }

    if (st) st.textContent = 'Guardado';
  } catch (e) {
    console.error('saveNotes', e);
    if (st) st.textContent = 'Error de red con Cloudflare.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadItems();
  loadNotes();

  document.getElementById('openAdd')?.addEventListener('click', openAddModal);
  document.getElementById('closeAdd')?.addEventListener('click', closeModal);
  document.getElementById('cancelAdd')?.addEventListener('click', closeModal);
  document.getElementById('sendAdd')?.addEventListener('click', sendForm);

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
