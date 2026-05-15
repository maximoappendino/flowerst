const SITE = window.__SITE__ || {
  storeName: 'Flowerst',
  whatsappNumber: '5493516763173',
  currency: 'ARS',
  queueFolderUrl: 'https://drive.google.com/drive/folders/1-VcN-RfnFKbAgGn7CnPR3miqHpChGY-o',
};

const CART_KEY = 'flowerst_cart';

// ── State ─────────────────────────────────────────────────────────────────────

let products = [];
let filtered = [];
let activeCategories = new Set();
let searchQuery = '';
let currentSort = '';

let currentProduct = null;
let currentImgIdx   = 0;
let currentVarIdx   = -1;
let currentQty      = 1;

let cart = [];

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('footer-year').textContent = new Date().getFullYear();
  document.getElementById('wa-general').href = `https://wa.me/${SITE.whatsappNumber}`;

  cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  updateCartCount();
  renderCart();

  await loadCatalog();
  bindEvents();
});

// ── Catalog ───────────────────────────────────────────────────────────────────

async function loadCatalog() {
  const inlineEl = document.getElementById('catalog-data');
  let data;

  if (inlineEl && inlineEl.textContent.trim()) {
    try {
      data = JSON.parse(inlineEl.textContent);
    } catch {}
  }

  if (!data || !Array.isArray(data.products) || data.products.length === 0) {
    const res = await fetch(`catalog.json?v=${Date.now()}`);
    data = await res.json();
  }

  products = data.products || [];
  buildTagFilters();
  applyFilters();
}

// ── Filters / Sort ────────────────────────────────────────────────────────────

function applyFilters() {
  let result = [...products];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.categories.some(c => c.toLowerCase().includes(q))
    );
  }

  if (activeCategories.size > 0) {
    result = result.filter(p => p.categories.some(c => activeCategories.has(c)));
  }

  switch (currentSort) {
    case 'name-asc':   result.sort((a, b) => a.title.localeCompare(b.title, 'es')); break;
    case 'name-desc':  result.sort((a, b) => b.title.localeCompare(a.title, 'es')); break;
    case 'price-asc':  result.sort((a, b) => a.price - b.price); break;
    case 'price-desc': result.sort((a, b) => b.price - a.price); break;
  }

  filtered = result;
  renderProducts();
}

function buildTagFilters() {
  const allCats = new Set(products.flatMap(p => p.categories));
  const container = document.getElementById('tag-filters');
  container.innerHTML = '';

  allCats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn';
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      if (activeCategories.has(cat)) {
        activeCategories.delete(cat);
        btn.classList.remove('active');
      } else {
        activeCategories.add(cat);
        btn.classList.add('active');
      }
      applyFilters();
    });
    container.appendChild(btn);
  });
}

// ── Render ────────────────────────────────────────────────────────────────────

function fmt(n) {
  return n.toLocaleString('es-AR');
}

function renderProducts() {
  const list     = document.getElementById('product-list');
  const noResult = document.getElementById('no-results');

  if (filtered.length === 0) {
    list.innerHTML = '';
    noResult.classList.remove('hidden');
    return;
  }

  noResult.classList.add('hidden');
  list.innerHTML = filtered.map(productCardHTML).join('');

  list.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      openModal(products.find(p => p.id === card.dataset.id));
    });
  });
}

function productCardHTML(p) {
  const imgHTML = p.images.length
    ? `<img src="${p.images[0]}" alt="${escHtml(p.title)}" loading="lazy">`
    : `<div class="img-placeholder">${escHtml(p.title.charAt(0).toUpperCase())}</div>`;

  const tagsHTML = p.categories.map(c => `<span class="card-tag">${escHtml(c)}</span>`).join('');
  const varsHTML = p.variations.length
    ? `<p class="card-vars">${p.variations.map(escHtml).join(' · ')}</p>`
    : '';

  return `
    <article class="product-card" data-id="${escHtml(p.id)}">
      <div class="card-img">${imgHTML}</div>
      <div class="card-info">
        <div class="card-tags">${tagsHTML}</div>
        <h3>${escHtml(p.title)}</h3>
        <p class="card-price">$${fmt(p.price)}</p>
        <p class="card-desc">${escHtml(p.description)}</p>
        ${varsHTML}
        <button class="btn-see-more">Ver más →</button>
      </div>
    </article>`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(product) {
  if (!product) return;
  currentProduct = product;
  currentImgIdx  = 0;
  currentVarIdx  = -1;
  currentQty     = 1;

  document.getElementById('modal-title').textContent    = product.title;
  document.getElementById('modal-desc').textContent     = product.description;
  document.getElementById('qty-val').textContent        = '1';

  updateModalPrice();
  renderModalGallery();
  renderModalVariations();

  document.getElementById('product-modal').classList.add('is-open');
  openOverlay();
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('product-modal').classList.remove('is-open');
  maybeCloseOverlay();
}

function updateModalPrice() {
  const price = (currentVarIdx >= 0 && currentProduct.variationPrices[currentVarIdx])
    ? currentProduct.variationPrices[currentVarIdx]
    : currentProduct.price;
  document.getElementById('modal-price').textContent = `$${fmt(price)}`;
}

function renderModalGallery() {
  const mainImg     = document.getElementById('modal-main-img');
  const placeholder = document.getElementById('modal-img-placeholder');
  const thumbs      = document.getElementById('modal-thumbs');

  if (!currentProduct.images.length) {
    mainImg.classList.add('hidden');
    placeholder.classList.remove('hidden');
    placeholder.textContent = currentProduct.title.charAt(0).toUpperCase();
    thumbs.innerHTML = '';
    return;
  }

  placeholder.classList.add('hidden');
  mainImg.classList.remove('hidden');
  mainImg.src = currentProduct.images[currentImgIdx];
  mainImg.alt = currentProduct.title;

  thumbs.innerHTML = currentProduct.images.map((url, i) =>
    `<img src="${url}" class="thumb${i === 0 ? ' active' : ''}" data-i="${i}" alt="" loading="lazy">`
  ).join('');

  thumbs.querySelectorAll('.thumb').forEach(t => {
    t.addEventListener('click', () => {
      currentImgIdx = parseInt(t.dataset.i);
      mainImg.src = currentProduct.images[currentImgIdx];
      thumbs.querySelectorAll('.thumb').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
    });
  });
}

function renderModalVariations() {
  const container = document.getElementById('modal-variations');
  if (!currentProduct.variations.length) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <p class="variations-label">Variaciones</p>
    <div class="variation-buttons">
      ${currentProduct.variations.map((v, i) => {
        const p = currentProduct.variationPrices[i];
        const sub = p ? ` — $${fmt(p)}` : '';
        return `<button class="variation-btn" data-i="${i}">${escHtml(v)}${sub}</button>`;
      }).join('')}
    </div>`;

  container.querySelectorAll('.variation-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.i);
      if (currentVarIdx === idx) {
        currentVarIdx = -1;
        btn.classList.remove('active');
      } else {
        currentVarIdx = idx;
        container.querySelectorAll('.variation-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
      updateModalPrice();
    });
  });
}

// ── Cart ──────────────────────────────────────────────────────────────────────

function addToCart() {
  const price = (currentVarIdx >= 0 && currentProduct.variationPrices[currentVarIdx])
    ? currentProduct.variationPrices[currentVarIdx]
    : currentProduct.price;

  const variation = currentVarIdx >= 0 ? currentProduct.variations[currentVarIdx] : null;
  const key       = `${currentProduct.id}||${variation ?? ''}`;
  const existing  = cart.find(i => i.key === key);

  if (existing) {
    existing.qty += currentQty;
  } else {
    cart.push({ key, id: currentProduct.id, title: currentProduct.title, variation, price, qty: currentQty });
  }

  saveCart();
  updateCartCount();
  closeModal();
  openCartPanel();
}

function removeFromCart(key) {
  cart = cart.filter(i => i.key !== key);
  saveCart();
  renderCart();
  updateCartCount();
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function updateCartCount() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cart-count');
  badge.textContent = total;
  badge.classList.toggle('hidden', total === 0);
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const totalEl   = document.getElementById('cart-total');
  const waBtn     = document.getElementById('btn-wa-cart');

  if (!cart.length) {
    container.innerHTML = '<p class="cart-empty">Tu carrito está vacío.</p>';
    totalEl.textContent = '$0';
    waBtn.disabled = true;
    return;
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <p class="cart-item-title">${escHtml(item.title)}</p>
        ${item.variation ? `<p class="cart-item-var">${escHtml(item.variation)}</p>` : ''}
        <p class="cart-item-price">$${fmt(item.price)} × ${item.qty} = <strong>$${fmt(item.price * item.qty)}</strong></p>
      </div>
      <button class="cart-remove" data-key="${escHtml(item.key)}" aria-label="Eliminar">×</button>
    </div>`).join('');

  container.querySelectorAll('.cart-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.key));
  });

  totalEl.textContent = `$${fmt(total)}`;
  waBtn.disabled = false;
}

function sendWhatsApp() {
  const lines = cart.map(i => {
    const v = i.variation ? ` (${i.variation})` : '';
    return `• ${i.title}${v} x${i.qty}: $${fmt(i.price * i.qty)}`;
  });
  const total   = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const message = `Hola! Quiero hacer un pedido en ${SITE.storeName}:\n\n${lines.join('\n')}\n\nTotal: $${fmt(total)}\n\n¡Gracias!`;
  window.open(`https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

// ── Panel helpers ─────────────────────────────────────────────────────────────

function openOverlay() {
  document.getElementById('overlay').classList.add('is-open');
}

function maybeCloseOverlay() {
  const modalOpen = document.getElementById('product-modal').classList.contains('is-open');
  const cartOpen  = document.getElementById('cart-panel').classList.contains('is-open');
  if (!modalOpen && !cartOpen) {
    document.getElementById('overlay').classList.remove('is-open');
    document.body.style.overflow = '';
  }
}

function openCartPanel() {
  renderCart();
  document.getElementById('cart-panel').classList.add('is-open');
  openOverlay();
  document.body.style.overflow = 'hidden';
}

function closeCartPanel() {
  document.getElementById('cart-panel').classList.remove('is-open');
  maybeCloseOverlay();
}

// ── Events ────────────────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('btn-reload').addEventListener('click', () => location.reload());

  document.getElementById('btn-upload').addEventListener('click', () => {
    window.open(SITE.queueFolderUrl, '_blank', 'noopener');
  });

  document.getElementById('btn-cart').addEventListener('click', openCartPanel);
  document.getElementById('cart-close').addEventListener('click', closeCartPanel);
  document.getElementById('modal-close').addEventListener('click', closeModal);

  document.getElementById('overlay').addEventListener('click', () => {
    closeModal();
    closeCartPanel();
  });

  document.getElementById('btn-add-cart').addEventListener('click', addToCart);
  document.getElementById('btn-wa-cart').addEventListener('click', sendWhatsApp);

  document.getElementById('qty-minus').addEventListener('click', () => {
    if (currentQty > 1) document.getElementById('qty-val').textContent = --currentQty;
  });
  document.getElementById('qty-plus').addEventListener('click', () => {
    document.getElementById('qty-val').textContent = ++currentQty;
  });

  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    applyFilters();
  });

  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sort = btn.dataset.sort;
      if (currentSort === sort) {
        currentSort = '';
        btn.classList.remove('active');
      } else {
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        currentSort = sort;
        btn.classList.add('active');
      }
      applyFilters();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeCartPanel(); }
  });
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
