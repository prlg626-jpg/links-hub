let allLinks = [];

async function loadLinks() {
  try {
    const response = await fetch('links.json');
    const data = await response.json();
    allLinks = data.links.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderLinks(allLinks);
  } catch (error) {
    console.error("Error cargando links:", error);
  }
}

function renderLinks(links) {
  const container = document.getElementById('linksContainer');
  container.innerHTML = '';

  links.forEach(link => {
    const card = document.createElement('div');
    card.className = 'card';

    card.innerHTML = `
      <h3>${link.title}</h3>
      <p>${link.note || ''}</p>
      <a href="${link.url}" target="_blank">Abrir enlace →</a>
    `;

    container.appendChild(card);
  });
}

document.getElementById('searchInput').addEventListener('input', function () {
  const searchTerm = this.value.toLowerCase();

  const filtered = allLinks.filter(link =>
    link.title.toLowerCase().includes(searchTerm) ||
    (link.note && link.note.toLowerCase().includes(searchTerm))
  );

  renderLinks(filtered);
});

loadLinks();
