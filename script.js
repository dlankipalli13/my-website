console.log("Website loaded!");

// ── Supabase Setup ──
const SUPABASE_URL = 'https://ignrxzfctylbdpkuyitk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnbnJ4emZjdHlsYmRwa3V5aXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzAzNTksImV4cCI6MjA5ODMwNjM1OX0.RQ06jDCw2LygqGIn4p5EamLkKeGt1VZDz1W6kWZJAWI';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── State ──
let products = [];
let basket = [];
let activeCategory = 'all';
let searchQuery = '';
let selectedSizes = {};

// ── Load Products ──
async function loadProducts() {
  document.getElementById('product-grid').innerHTML =
    '<p style="padding:48px; color:#888;">Loading products...</p>';

  const { data, error } = await db.from('products').select('*');

  if (error) {
    console.error('Error loading products:', error);
    document.getElementById('product-grid').innerHTML =
      '<p style="padding:48px; color:red;">Failed to load products.</p>';
    return;
  }

  products = data;
  renderFilters();
  applyFilters();
  updateNavCount();
}

function updateNavCount() {
  const basket = JSON.parse(localStorage.getItem('noir-basket') || '[]');
  const count = basket.reduce((sum, item) => sum + item.quantity, 0);
  const el = document.getElementById('basket-count');
  if (el) el.textContent = count;
}

// ── Search ──
function handleSearch() {
  searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
  applyFilters();
}

// ── Apply Filters ──
function applyFilters() {
  let filtered = products;

  if (activeCategory !== 'all') {
    filtered = filtered.filter(p => p.category === activeCategory);
  }

  if (searchQuery !== '') {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(searchQuery) ||
      p.description.toLowerCase().includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery)
    );
  }

  renderProducts(filtered);
}

// ── Render Filters ──
function renderFilters() {
  const categories = ['all', ...new Set(products.map(p => p.category))];
  document.getElementById('filter-bar').innerHTML = categories.map(cat => `
    <button class="filter-btn ${cat === 'all' ? 'active' : ''}"
      onclick="filterProducts('${cat}')">
      ${cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
    </button>
  `).join('');
}

// ── Filter by Category ──
function filterProducts(category) {
  activeCategory = category;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active',
      btn.textContent.toLowerCase().trim() === category ||
      (category === 'all' && btn.textContent.trim() === 'All')
    );
  });
  applyFilters();
}

// ── Render Cards ──
function renderProducts(filtered) {
  const grid = document.getElementById('product-grid');

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="padding:48px; color:#888;">No products found.</p>';
    document.getElementById('modal-container').innerHTML = '';
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="product-card cat-${p.category}" onclick="window.location.href='product.html?id=${p.id}'">
      <img src="${p.image}" alt="${p.name}">
      <div class="card-meta">
        <div>
          <h2>${p.name}</h2>
          <p class="price">£${parseFloat(p.price).toFixed(2)}</p>
        </div>
        <span class="card-arrow">→</span>
      </div>
    </div>
  `).join('');

  renderModals(filtered);
}

// ── Render Modals ──
function renderModals(filtered) {
  document.getElementById('modal-container').innerHTML = filtered.map(p => {
    const stockBySize = p.stock_by_size || {};
    const sizes = Object.keys(stockBySize);
    const isOneSize = sizes.length === 1 && sizes[0] === 'One Size';
    const totalStock = Object.values(stockBySize).reduce((a, b) => a + b, 0);

    const sizeHTML = sizes.map(size => {
      const sizeStock = stockBySize[size];
      const outOfStock = sizeStock <= 0;
      return `
        <button
          class="size-btn ${outOfStock ? 'out-of-stock' : ''}"
          onclick="${outOfStock ? '' : `selectSize('${p.id}', '${size}', this)`}"
          ${outOfStock ? 'disabled' : ''}
          title="${outOfStock ? 'Out of stock' : `${sizeStock} left`}">
          ${size}${outOfStock ? ' ✕' : ''}
        </button>
      `;
    }).join('');

    return `
      <div class="modal" id="modal-${p.id}">
        <div class="modal-content">
          <button class="close" onclick="closeModal('modal-${p.id}')">&times;</button>
          <img src="${p.image}" alt="${p.name}">
          <h2>${p.name}</h2>
          <p class="price">£${parseFloat(p.price).toFixed(2)}</p>
          <p class="stock" id="stock-${p.id}">
            ${totalStock > 0 ? `${totalStock} units across all sizes` : 'Out of Stock'}
          </p>
          <p class="description">${p.description}</p>

          ${!isOneSize ? `
            <span class="size-label">Select Size</span>
            <div class="size-options" id="sizes-${p.id}">${sizeHTML}</div>
            <p class="size-stock-hint" id="size-hint-${p.id}"></p>
          ` : ''}

          <button class="btn-primary"
            onclick="addToBasket('${p.id}', '${p.name}', ${p.price}, ${!isOneSize})">
            Add to Basket
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Size Selection ──
function selectSize(productId, size, btn) {
  document.querySelectorAll(`#sizes-${productId} .size-btn`).forEach(b => {
    b.classList.remove('selected');
  });
  btn.classList.add('selected');
  selectedSizes[productId] = size;

  // Show stock hint for selected size
  const product = products.find(p => p.id == productId);
  const sizeStock = product?.stock_by_size?.[size] ?? 0;
  const hint = document.getElementById(`size-hint-${productId}`);
  if (hint) {
    hint.textContent = sizeStock <= 3
      ? `Only ${sizeStock} left in ${size}!`
      : `${sizeStock} available in ${size}`;
    hint.style.color = sizeStock <= 3 ? '#c0392b' : '#888';
  }
}

// ── Modal Controls ──
function openModal(id) {
  if (!document.getElementById(id)) renderModals(products);
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  const productId = id.replace('modal-', '');
  delete selectedSizes[productId];
  document.querySelectorAll(`#sizes-${productId} .size-btn`).forEach(b => {
    b.classList.remove('selected');
  });
  const hint = document.getElementById(`size-hint-${productId}`);
  if (hint) hint.textContent = '';
}

window.addEventListener('click', e => {
  document.querySelectorAll('.modal').forEach(modal => {
    if (e.target === modal) {
      const productId = modal.id.replace('modal-', '');
      delete selectedSizes[productId];
      modal.classList.remove('active');
    }
  });
});

// ── Basket ──
function addToBasket(id, name, price, hasSizes) {
  const product = products.find(p => p.id == id);
  if (!product) return;

  const stockBySize = product.stock_by_size || {};

  if (hasSizes && !selectedSizes[id]) {
    alert("Please select a size first.");
    return;
  }

  const size = selectedSizes[id] || 'One Size';
  const sizeStock = stockBySize[size] ?? 0;

  if (sizeStock <= 0) {
    alert(`Sorry, ${size} is out of stock!`);
    return;
  }

  const basketKey = `${id}-${size}`;
  const displayName = size !== 'One Size' ? `${name} (${size})` : name;
  const existing = basket.find(item => item.basketKey === basketKey);

  if (existing) {
    if (existing.quantity >= sizeStock) {
      alert(`Only ${sizeStock} left in size ${size}!`);
      return;
    }
    existing.quantity++;
  } else {
    basket.push({ id, basketKey, name: displayName, price, quantity: 1, size });
  }

  updateBasketUI();
  closeModal(`modal-${id}`);
}

function addOneToBasket(basketKey) {
  const existing = basket.find(item => item.basketKey === basketKey);
  if (!existing) return;
  const product = products.find(p => p.id == existing.id);
  const sizeStock = product?.stock_by_size?.[existing.size] ?? 0;
  if (existing.quantity >= sizeStock) {
    alert(`Only ${sizeStock} left in size ${existing.size}!`);
    return;
  }
  existing.quantity++;
  updateBasketUI();
}

function removeFromBasket(basketKey) {
  const existing = basket.find(item => item.basketKey === basketKey);
  if (existing) {
    existing.quantity > 1
      ? existing.quantity--
      : (basket = basket.filter(i => i.basketKey !== basketKey));
  }
  updateBasketUI();
}

function removeAllOfItem(basketKey) {
  basket = basket.filter(item => item.basketKey !== basketKey);
  updateBasketUI();
}

function updateBasketUI() {
  const basketItems = document.getElementById('basket-items');
  const basketCount = document.getElementById('basket-count');
  const basketTotal = document.getElementById('basket-total');

  basketCount.textContent = basket.reduce((sum, item) => sum + item.quantity, 0);

  if (basket.length === 0) {
    basketItems.innerHTML =
      '<p style="color:#888; font-size:0.9rem; padding:20px 0;">Your basket is empty.</p>';
    basketTotal.textContent = '£0.00';
    return;
  }

  let total = 0;
  basketItems.innerHTML = basket.map(item => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    return `
      <div class="basket-item">
        <div>
          <strong>${item.name}</strong><br>
          <small>£${parseFloat(item.price).toFixed(2)} each</small>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="qty-btn" onclick="removeFromBasket('${item.basketKey}')">−</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" onclick="addOneToBasket('${item.basketKey}')">+</button>
          <span>£${itemTotal.toFixed(2)}</span>
          <button class="remove-btn" onclick="removeAllOfItem('${item.basketKey}')">✕</button>
        </div>
      </div>
    `;
  }).join('');

  basketTotal.textContent = `£${total.toFixed(2)}`;
}

function openBasket() { document.getElementById('basket-modal').classList.add('active'); }
function closeBasket() { document.getElementById('basket-modal').classList.remove('active'); }

function openCheckout() {
  if (basket.length === 0) { alert("Your basket is empty!"); return; }
  closeBasket();
  document.getElementById('checkout-modal').classList.add('active');
}

function closeCheckout() {
  document.getElementById('checkout-modal').classList.remove('active');
  clearErrors();
}

async function placeOrder() {
  const name   = document.getElementById('card-name').value.trim();
  const number = document.getElementById('card-number').value.trim();
  const expiry = document.getElementById('card-expiry').value.trim();
  const cvv    = document.getElementById('card-cvv').value.trim();

  // Clear previous errors
  clearErrors();

  let hasErrors = false;

  // Name — letters and spaces only, at least two words
  if (!/^[a-zA-Z]+([\s][a-zA-Z]+)+$/.test(name)) {
    showError('card-name', 'Enter your full name as it appears on your card');
    hasErrors = true;
  }

  // Card number — exactly 16 digits
  if (!/^\d{16}$/.test(number.replace(/\s/g, ''))) {
    showError('card-number', 'Card number must be exactly 16 digits');
    hasErrors = true;
  }

  // Expiry — MM/YY format, not in the past
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
    showError('card-expiry', 'Enter a valid expiry date (MM/YY)');
    hasErrors = true;
  } else {
    const [month, year] = expiry.split('/').map(Number);
    const now = new Date();
    const currentYear  = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      showError('card-expiry', 'Your card has expired');
      hasErrors = true;
    }
  }

  // CVV — exactly 3 digits
  if (!/^\d{3}$/.test(cvv)) {
    showError('card-cvv', 'CVV must be exactly 3 digits');
    hasErrors = true;
  }

  if (hasErrors) return;

  // ── Deduct stock per size in Supabase ──
  for (const item of basket) {
    const product = products.find(p => p.id == item.id);
    const updatedStock = { ...product.stock_by_size };
    updatedStock[item.size] = (updatedStock[item.size] || 0) - item.quantity;

    const { error } = await db
      .from('products')
      .update({ stock_by_size: updatedStock })
      .eq('id', item.id);

    if (!error) {
      product.stock_by_size = updatedStock;
      const totalStock = Object.values(updatedStock).reduce((a, b) => a + b, 0);
      const stockEl = document.getElementById(`stock-${item.id}`);
      if (stockEl) {
        stockEl.textContent = totalStock > 0
          ? `${totalStock} units across all sizes`
          : 'Out of Stock';
      }
    }
  }

  basket = [];
  updateBasketUI();
  closeCheckout();
  document.getElementById('success-modal').classList.add('active');
}

function showError(inputId, message) {
  const input = document.getElementById(inputId);
  input.classList.add('input-error');
  const error = document.createElement('p');
  error.className = 'error-msg';
  error.textContent = message;
  input.parentNode.insertBefore(error, input.nextSibling);
}

function clearErrors() {
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  document.querySelectorAll('.error-msg').forEach(el => el.remove());
}

function closeSuccess() { document.getElementById('success-modal').classList.remove('active'); }

// ── Global ──
window.filterProducts   = filterProducts;
window.handleSearch     = handleSearch;
window.openModal        = openModal;
window.closeModal       = closeModal;
window.selectSize       = selectSize;
window.addToBasket      = addToBasket;
window.addOneToBasket   = addOneToBasket;
window.removeFromBasket = removeFromBasket;
window.removeAllOfItem  = removeAllOfItem;
window.openBasket       = openBasket;
window.closeBasket      = closeBasket;
window.openCheckout     = openCheckout;
window.closeCheckout    = closeCheckout;
window.placeOrder       = placeOrder;
window.closeSuccess     = closeSuccess;

loadProducts();