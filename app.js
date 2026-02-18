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
