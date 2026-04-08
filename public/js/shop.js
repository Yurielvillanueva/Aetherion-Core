const shopGrid = document.getElementById('shop-grid');
const categoryButtons = document.querySelectorAll('.category-button');
let shopItems = [];

async function loadShop(category = 'all') {
  const endpoint = category === 'all' ? '/api/shop' : `/api/shop/${category}`;
  const response = await fetch(endpoint);
  const json = await response.json();
  shopItems = json.items || [];
  renderShop();
}

function renderShop() {
  shopGrid.innerHTML = shopItems.length ? shopItems.map(item => `
    <article class="card">
      <h3>${item.name}</h3>
      <p class="small">${item.category}</p>
      <p>${item.description}</p>
      <div class="status-row"><span>Price</span><strong>${item.price} coins</strong></div>
    </article>
  `).join('') : '<div class="card"><p>No items found.</p></div>';
}

categoryButtons.forEach(button => {
  button.addEventListener('click', () => {
    categoryButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    loadShop(button.dataset.category);
  });
});

window.addEventListener('DOMContentLoaded', () => loadShop());
