const SUPABASE_URL = 'https://ignrxzfctylbdpkuyitk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnbnJ4emZjdHlsYmRwa3V5aXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzAzNTksImV4cCI6MjA5ODMwNjM1OX0.RQ06jDCw2LygqGIn4p5EamLkKeGt1VZDz1W6kWZJAWI';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let product = null;
let selectedSize = null;
let basket = JSON.parse(localStorage.getItem('noir-basket') || '[]');

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    document.getElementById('product-page').innerHTML =
      '<p style="padding:48px; color:red;">Product not found.</p>';
    return;
  }

  const { data, error } = await db.from('products').select('*').eq('id', id).single();

  if (error || !data) {
    document.getElementById('product-page').innerHTML =
      '<p style="padding:48px; color:red;">Product not found.</p>';
    return;
  }

  product = data;
  document.title = `${product.name} — Noir & Co.`;
  renderProduct();
  updateNavCount();
}

function updateNavCount() {
  const count = basket.reduce((sum, item) => sum + item.quantity, 0);
  const el = document.getElementById('basket-count');
  if (el) el.textContent = count;
}

function renderProduct() {
  const stockBySize = product.stock_by_size || {};
  const sizes = Object.keys(stockBySize);
  const isOneSize = sizes.length === 1 && sizes[0] === 'One Size';
  const totalStock = Object.values(stockBySize).reduce((a, b) => a + b, 0);

  const sizeHTML = !isOneSize ? `
    <div class="product-page-sizes">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span class="size-label" style="margin:0;">Select Size</span>
        <span style="font-size:0.75rem; color:#888; cursor:pointer; text-decoration:underline;">Size guide</span>
      </div>
      <div class="size-options" id="size-options">
        ${sizes.map(size => {
          const sizeStock = stockBySize[size];
          const oos = sizeStock <= 0;
          return `
            <button class="size-btn ${oos ? 'out-of-stock' : ''}"
              onclick="${oos ? '' : `selectSize('${size}', this)`}"
              ${oos ? 'disabled' : ''}
              title="${oos ? 'Out of stock' : `${sizeStock} left`}">
              ${size}${oos ? ' ✕' : ''}
            </button>
          `;
        }).join('')}
      </div>
      <p id="size-hint" class="size-stock-hint"></p>
    </div>
  ` : '';

  document.getElementById('product-page').innerHTML = `
    <div class="product-page-inner">

      <!-- Left: Image -->
      <div class="product-page-image">
        <a href="index.html" class="product-back-link">← Back to Collection</a>
        <img src="${product.image}" alt="${product.name}">
      </div>

      <!-- Right: Details -->
      <div class="product-page-details">
        <p class="section-eyebrow">${product.category.charAt(0).toUpperCase() + product.category.slice(1)}</p>
        <h1>${product.name}</h1>
        <p class="product-page-price">£${parseFloat(product.price).toFixed(2)}</p>

        <div class="product-page-divider"></div>

        <p class="product-page-description">${product.description}</p>

        <div class="product-page-divider"></div>

        ${sizeHTML}

        <p id="product-stock-msg" class="product-stock-msg">
          ${totalStock > 0 ? `${totalStock} units available` : 'Out of Stock'}
        </p>

        <button class="btn-primary product-page-atb" id="atb-btn"
          onclick="addToBasket()" ${totalStock <= 0 ? 'disabled' : ''}>
          ${totalStock > 0 ? 'Add to Basket' : 'Out of Stock'}
        </button>

        <a href="basket.html" class="product-view-basket" id="view-basket-link" style="display:none;">
          View Basket →
        </a>

        <!-- Details accordion -->
        <div class="product-page-accordion">
          <div class="accordion-item" onclick="toggleAccordion(this)">
            <div class="accordion-header">
              <span>Delivery & Returns</span> <span class="accordion-icon">+</span>
            </div>
            <div class="accordion-body">
              <p>Free UK delivery on all orders. Delivered within 2–4 working days.</p>
              <p>Free returns within 30 days. Items must be unworn with original tags attached.</p>
            </div>
          </div>
          <div class="accordion-item" onclick="toggleAccordion(this)">
            <div class="accordion-header">
              <span>Materials & Care</span> <span class="accordion-icon">+</span>
            </div>
            <div class="accordion-body">
              <p>Made from natural fibres where possible. Machine wash at 30°C. Do not tumble dry. Iron on a low heat.</p>
            </div>
          </div>
          <div class="accordion-item" onclick="toggleAccordion(this)">
            <div class="accordion-header">
              <span>Sizing</span> <span class="accordion-icon">+</span>
            </div>
            <div class="accordion-body">
              <p>This piece fits true to size. If you are between sizes we recommend sizing up for a relaxed fit.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function selectSize(size, btn) {
  document.querySelectorAll('#size-options .size-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedSize = size;

  const sizeStock = product.stock_by_size?.[size] ?? 0;
  const hint = document.getElementById('size-hint');
  if (hint) {
    hint.textContent = sizeStock <= 3 ? `Only ${sizeStock} left in ${size}!` : `${sizeStock} available in ${size}`;
    hint.style.color = sizeStock <= 3 ? '#c0392b' : '#888';
  }
}

function addToBasket() {
  const stockBySize = product.stock_by_size || {};
  const sizes = Object.keys(stockBySize);
  const isOneSize = sizes.length === 1 && sizes[0] === 'One Size';

  if (!isOneSize && !selectedSize) {
    alert("Please select a size first.");
    return;
  }

  const size = selectedSize || 'One Size';
  const sizeStock = stockBySize[size] ?? 0;

  if (sizeStock <= 0) {
    alert(`Sorry, ${size} is out of stock!`);
    return;
  }

  const basketKey = `${product.id}-${size}`;
  const displayName = size !== 'One Size' ? `${product.name} (${size})` : product.name;
  const existing = basket.find(i => i.basketKey === basketKey);

  if (existing) {
    if (existing.quantity >= sizeStock) {
      alert(`Only ${sizeStock} left in size ${size}!`);
      return;
    }
    existing.quantity++;
  } else {
    basket.push({
      id: product.id,
      basketKey,
      name: displayName,
      price: product.price,
      image: product.image,
      quantity: 1,
      size
    });
  }

  localStorage.setItem('noir-basket', JSON.stringify(basket));
  updateNavCount();

  // Show view basket link
  const link = document.getElementById('view-basket-link');
  if (link) link.style.display = 'block';

  // Briefly change button text
  const btn = document.getElementById('atb-btn');
  btn.textContent = '✓ Added to Basket';
  setTimeout(() => { btn.textContent = 'Add to Basket'; }, 2000);
}

function toggleAccordion(item) {
  const body = item.querySelector('.accordion-body');
  const icon = item.querySelector('.accordion-icon');
  const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';
  body.style.maxHeight = isOpen ? '0px' : body.scrollHeight + 'px';
  icon.textContent = isOpen ? '+' : '−';
}

window.selectSize     = selectSize;
window.addToBasket    = addToBasket;
window.toggleAccordion = toggleAccordion;

init();