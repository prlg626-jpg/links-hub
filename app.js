let allLinks = [];

function safeText(value) {
  return String(value || '').replace(/[<>&"]/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;'
  }[c]));
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

async function loadLinks() {
  try {
    const response = await fetch('links.json', { cache: 'no-store' });
    const data = await response.json();

    allLinks = (data.links || []).map((x) => ({
      title: x.title || 'Sin título',
      url: x.url || '#',
      note: x.note || '',
      category: x.category || 'General',
      date: x.date || ''
    }));

    allLinks.sort((a, b) => new Date(b.date || '1970-01-01') - new Date(a.date || '1970-01-01'));
    renderLinks(allLinks);
  } catch (error) {
    console.error('Error cargando links:', error);
    const container = document.getElementById('linksContainer');
    container.innerHTML = '<div class="empty">No se pudieron cargar los links.</div>';
  }
}

function renderLinks(links) {
  const container = document.getElementById('linksContainer');
  container.innerHTML = '';

  if (!links.length) {
    container.innerHTML = '<div class="empty">No hay resultados.</div>';
    return;
  }

  links.forEach((link) => {
    const domain = getDomain(link.url);
    const card = document.createElement('div');
    card.className = 'card';

    card.innerHTML = `
      <div class="topline">
        <span class="badge">${safeText(link.category)}</span>
        <span class="meta">${safeText(domain)}${link.date ? ' · ' + safeText(formatDate(link.date)) : ''}</span>
      </div>

      <h3>${safeText(link.title)}</h3>

      ${link.note ? `<p>${safeText(link.note)}</p>` : `<p class="muted">Sin nota.</p>`}

      <div class="actions">
        <a class="btn" href="${safeText(link.url)}" target="_blank" rel="noopener noreferrer">Abrir</a>
        <button class="ghost" type="button" data-copy="${safeText(link.url)}">Copiar link</button>
      </div>
    `;

    container.appendChild(card);
  });

  container.querySelectorAll('button[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = btn.getAttribute('data-copy') || '';
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = 'Copiado';
        setTimeout(() => (btn.textContent = 'Copiar link'), 900);
      } catch {
        btn.textContent = 'No se pudo copiar';
        setTimeout(() => (btn.textContent = 'Copiar link'), 1200);
      }
    });
  });
}

document.getElementById('searchInput').addEventListener('input', function () {
  const term = this.value.toLowerCase().trim();

  const filtered = allLinks.filter((l) => {
    const hay = `${l.title} ${l.note} ${l.category} ${getDomain(l.url)}`.toLowerCase();
    return hay.includes(term);
  });

  renderLinks(filtered);
});

loadLinks();

const WORKER_URL = "https://links-hub-api.prlg626.workers.dev";

function setStatus(msg) {
  const el = document.getElementById('statusBar');
  if (!el) return;
  el.textContent = msg || '';
}

function openModal() {
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

document.getElementById('openAdd').addEventListener('click', openModal);
document.getElementById('closeAdd').addEventListener('click', closeModal);
document.getElementById('cancelAdd').addEventListener('click', closeModal);

document.getElementById('sendAdd').addEventListener('click', async () => {
  const title = document.getElementById('fTitle').value.trim();
  const url = document.getElementById('fUrl').value.trim();
  const category = document.getElementById('fCat').value.trim();
  const note = document.getElementById('fNote').value.trim();
  const password = document.getElementById('fPass').value;

  if (!url || !url.startsWith('http')) {
    setStatus('URL inválida.');
    return;
  }

  setStatus('Enviando link...');
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, url, category, note, password })
    });

    const text = await res.text();

    if (!res.ok) {
      setStatus('Error: ' + text);
      return;
    }

    setStatus('Listo. En 30–60 segundos aparecerá en el hub.');
    closeModal();

    document.getElementById('fTitle').value = '';
    document.getElementById('fUrl').value = '';
    document.getElementById('fCat').value = '';
    document.getElementById('fNote').value = '';
    document.getElementById('fPass').value = '';

    setTimeout(() => loadLinks(), 65000);
  } catch (e) {
    setStatus('Error de red. Revisa el Worker.');
  }
});
