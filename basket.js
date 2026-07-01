const SUPABASE_URL = 'https://ignrxzfctylbdpkuyitk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnbnJ4emZjdHlsYmRwa3V5aXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzAzNTksImV4cCI6MjA5ODMwNjM1OX0.RQ06jDCw2LygqGIn4p5EamLkKeGt1VZDz1W6kWZJAWI';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let products = [];
let basket = JSON.parse(localStorage.getItem('noir-basket') || '[]');

async function init() {
  const { data } = await db.from('products').select('*');
  products = data || [];
  renderBasket();
  updateNavCount();
}

function saveBasket() {
  localStorage.setItem('noir-basket', JSON.stringify(basket));
}

function updateNavCount() {
  const count = basket.reduce((sum, item) => sum + item.quantity, 0);
  const el = document.getElementById('basket-count');
  if (el) el.textContent = count;
}

function renderBasket() {
  const list = document.getElementById('basket-page-list');

  if (basket.length === 0) {
    list.innerHTML = `
      <div class="basket-empty">
        <p>Your basket is empty.</p>
        <a href="index.html" class="cta-btn" style="margin-top:20px; display:inline-block;">
          Shop the Collection
        </a>
      </div>
    `;
    updateSummary(0);
    return;
  }

  list.innerHTML = basket.map(item => `
    <div class="basket-page-item">
      <img src="${item.image}" alt="${item.name}">
      <div class="basket-page-item-info">
        <h3>${item.name}</h3>
        ${item.size && item.size !== 'One Size' ? `<p class="basket-item-size">Size: ${item.size}</p>` : ''}
        <p class="basket-item-price">£${parseFloat(item.price).toFixed(2)}</p>
      </div>
      <div class="basket-page-item-controls">
        <div class="qty-controls">
          <button class="qty-btn" onclick="changeQty('${item.basketKey}', -1)">−</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" onclick="changeQty('${item.basketKey}', 1)">+</button>
        </div>
        <p class="basket-item-subtotal">£${(item.price * item.quantity).toFixed(2)}</p>
        <button class="basket-remove-link" onclick="removeItem('${item.basketKey}')">Remove</button>
      </div>
    </div>
  `).join('');

  const total = basket.reduce((sum, item) => sum + item.price * item.quantity, 0);
  updateSummary(total);
}

function updateSummary(total) {
  document.getElementById('summary-subtotal').textContent = `£${total.toFixed(2)}`;
  document.getElementById('summary-delivery').textContent = total > 0 ? 'Free' : '—';
  document.getElementById('summary-total').textContent = `£${total.toFixed(2)}`;
}

function changeQty(basketKey, delta) {
  const item = basket.find(i => i.basketKey === basketKey);
  if (!item) return;

  const product = products.find(p => p.id == item.id);
  const sizeStock = product?.stock_by_size?.[item.size] ?? 999;

  if (delta === 1 && item.quantity >= sizeStock) {
    alert(`Only ${sizeStock} left in this size!`);
    return;
  }

  item.quantity += delta;
  if (item.quantity <= 0) {
    basket = basket.filter(i => i.basketKey !== basketKey);
  }

  saveBasket();
  renderBasket();
  updateNavCount();
}

function removeItem(basketKey) {
  basket = basket.filter(i => i.basketKey !== basketKey);
  saveBasket();
  renderBasket();
  updateNavCount();
}

function openCheckoutPage() {
  if (basket.length === 0) { alert("Your basket is empty!"); return; }
  document.querySelector('.basket-page-body').style.display = 'none';
  document.getElementById('checkout-section').style.display = 'block';
  window.scrollTo(0, 0);
}

function closeCheckoutPage() {
  document.querySelector('.basket-page-body').style.display = 'grid';
  document.getElementById('checkout-section').style.display = 'none';
  document.getElementById('checkout-errors').innerHTML = '';
}

function showError(inputId, message) {
  const input = document.getElementById(inputId);
  input.classList.add('input-error');
  document.getElementById('checkout-errors').innerHTML +=
    `<p class="error-msg">${message}</p>`;
}

async function placeOrder() {
  const name   = document.getElementById('card-name').value.trim();
  const number = document.getElementById('card-number').value.trim();
  const expiry = document.getElementById('card-expiry').value.trim();
  const cvv    = document.getElementById('card-cvv').value.trim();

  document.getElementById('checkout-errors').innerHTML = '';
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

  let hasErrors = false;

  if (!/^[a-zA-Z]+([\s][a-zA-Z]+)+$/.test(name)) {
    showError('card-name', 'Enter your full name as it appears on your card');
    hasErrors = true;
  }
  if (!/^\d{16}$/.test(number.replace(/\s/g, ''))) {
    showError('card-number', 'Card number must be exactly 16 digits');
    hasErrors = true;
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
    showError('card-expiry', 'Enter a valid expiry date (MM/YY)');
    hasErrors = true;
  } else {
    const [month, year] = expiry.split('/').map(Number);
    const now = new Date();
    if (year < now.getFullYear() % 100 ||
       (year === now.getFullYear() % 100 && month < now.getMonth() + 1)) {
      showError('card-expiry', 'Your card has expired');
      hasErrors = true;
    }
  }
  if (!/^\d{3}$/.test(cvv)) {
    showError('card-cvv', 'CVV must be exactly 3 digits');
    hasErrors = true;
  }

  if (hasErrors) return;

  for (const item of basket) {
    const product = products.find(p => p.id == item.id);
    if (!product) continue;
    const updatedStock = { ...product.stock_by_size };
    updatedStock[item.size] = (updatedStock[item.size] || 0) - item.quantity;
    await db.from('products').update({ stock_by_size: updatedStock }).eq('id', item.id);
    product.stock_by_size = updatedStock;
  }

  basket = [];
  saveBasket();

  document.getElementById('checkout-section').style.display = 'none';
  document.getElementById('success-section').style.display = 'block';
  window.scrollTo(0, 0);
}

window.changeQty        = changeQty;
window.removeItem       = removeItem;
window.openCheckoutPage = openCheckoutPage;
window.closeCheckoutPage= closeCheckoutPage;
window.placeOrder       = placeOrder;

init();