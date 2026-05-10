"use strict";

/**
 * catalog.js
 *
 * Reads the catalog JSON embedded in the page at build time, renders
 * product cards (alternating layout), and lazy-loads images as the user
 * scrolls. Also handles category filtering and text search.
 */

(function () {
  // ── Helpers ──────────────────────────────────────────────────────────────

  function formatPrice(raw) {
    if (!raw) return "";
    const n = parseFloat(String(raw).replace(/[^\d.,]/g, "").replace(",", "."));
    if (isNaN(n)) return raw;
    return "$ " + n.toLocaleString("es-AR");
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Convert Google Drive share link → direct embeddable URL.
  // lh3.googleusercontent.com/d/ID returns the image directly (200 + CORS *),
  // unlike uc?export=view which only returns a 303 redirect that breaks <img>.
  function normalizeImage(url) {
    if (!url) return "";
    const m1 = url.match(/\/file\/d\/([-\w]+)/);
    if (m1) return `https://lh3.googleusercontent.com/d/${m1[1]}`;
    const m2 = url.match(/[?&]id=([-\w]+)/);
    if (m2) return `https://lh3.googleusercontent.com/d/${m2[1]}`;
    return url;
  }

  // ── Lazy-loading via IntersectionObserver ─────────────────────────────────

  const imageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute("data-src");
        }
        imageObserver.unobserve(img);
      });
    },
    { rootMargin: "200px 0px" }
  );

  // Animate cards into view
  const cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          cardObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );

  // 1×1 transparent SVG — prevents broken-image icon while real src is pending
  const BLANK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";

  // ── Build card HTML ───────────────────────────────────────────────────────

  function buildCard(product, index) {
    const isFlipped = index % 2 === 1;
    const imgUrl = normalizeImage(product.imageUrl);

    // No loading="lazy" — we drive that ourselves via IntersectionObserver
    const imageHtml = imgUrl
      ? `<img data-src="${escHtml(imgUrl)}"
              src="${BLANK}"
              alt="${escHtml(product.name)}"
              width="600" height="400">`
      : `<div class="product-image-placeholder">🌸</div>`;

    const variantsHtml =
      product.variants && product.variants.length
        ? `<div class="product-variants" data-product="${product.id}">
            ${product.variants
              .map(
                (v, i) =>
                  `<button class="variant-btn${i === 0 ? " selected" : ""}"
                           data-name="${escHtml(v.name)}"
                           data-price="${escHtml(v.price)}"
                           data-id="${product.id}">
                    ${escHtml(v.name)}${v.price ? " · " + formatPrice(v.price) : ""}
                  </button>`
              )
              .join("")}
          </div>`
        : "";

    // rawPrice is the plain number string from the spreadsheet ("10000").
    // displayPrice is the formatted string for the UI ("$ 10.000").
    // data-price always stores rawPrice so cartTotal can parse it correctly.
    const rawPrice =
      product.variants && product.variants.length
        ? product.variants[0].price || product.price
        : product.price;
    const displayPrice = formatPrice(rawPrice);

    return `
      <article class="product-card${isFlipped ? " flipped" : ""}"
               data-id="${product.id}"
               data-name="${escHtml(product.name).toLowerCase()}"
               data-category="${escHtml(product.category).toLowerCase()}"
               data-description="${escHtml(product.description).toLowerCase()}">

        <div class="product-image">${imageHtml}</div>

        <div class="product-info">
          ${product.category ? `<span class="product-category">${escHtml(product.category)}</span>` : ""}
          <h3 class="product-name">${escHtml(product.name)}</h3>
          ${product.description ? `<p class="product-description">${escHtml(product.description)}</p>` : ""}
          ${variantsHtml}
          <p class="product-price" data-base-price="${escHtml(product.price)}"
             id="price-${product.id}">${displayPrice}</p>
          <div class="product-actions">
            <button class="btn btn-primary add-to-cart"
                    data-id="${product.id}"
                    data-name="${escHtml(product.name)}"
                    data-price="${escHtml(rawPrice)}"
                    data-image="${escHtml(imgUrl)}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              Agregar al carrito
            </button>
          </div>
        </div>
      </article>`;
  }

  // ── Render catalog ────────────────────────────────────────────────────────

  let allProducts = [];
  let activeCategory = "all";
  let searchQuery = "";

  function render() {
    const list = document.getElementById("catalog-list");
    const noResults = document.getElementById("catalog-no-results");
    if (!list) return;

    const filtered = allProducts.filter((p) => {
      const matchCat =
        activeCategory === "all" ||
        p.category.toLowerCase() === activeCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });

    list.innerHTML = filtered.map((p, i) => buildCard(p, i)).join("");
    noResults.style.display = filtered.length === 0 ? "block" : "none";

    // Observe lazy images and card animations
    list.querySelectorAll("img[data-src]").forEach((img) => imageObserver.observe(img));
    list.querySelectorAll(".product-card").forEach((card) => cardObserver.observe(card));

    // Attach variant selection
    list.querySelectorAll(".variant-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const productId = btn.dataset.id;
        const siblings = list.querySelectorAll(`.variant-btn[data-id="${productId}"]`);
        siblings.forEach((s) => s.classList.remove("selected"));
        btn.classList.add("selected");

        // Update price display
        const priceEl = document.getElementById(`price-${productId}`);
        if (priceEl && btn.dataset.price) {
          priceEl.textContent = formatPrice(btn.dataset.price);
        }

        // Update the add-to-cart button data
        const addBtn = list.querySelector(`.add-to-cart[data-id="${productId}"]`);
        if (addBtn) {
          addBtn.dataset.price = btn.dataset.price
            ? formatPrice(btn.dataset.price)
            : addBtn.dataset.price;
          addBtn.dataset.variant = btn.dataset.name;
        }
      });
    });
  }

  // ── Build category filters ────────────────────────────────────────────────

  function buildFilters() {
    const container = document.getElementById("catalog-filters");
    if (!container) return;

    const categories = ["all", ...new Set(allProducts.map((p) => p.category).filter(Boolean))];

    container.innerHTML = categories
      .map(
        (cat) =>
          `<button class="filter-btn${cat === "all" ? " active" : ""}"
                   data-category="${escHtml(cat)}">
            ${cat === "all" ? "Todos" : escHtml(cat)}
          </button>`
      )
      .join("");

    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      container.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeCategory = btn.dataset.category;
      render();
    });
  }

  // ── Search ────────────────────────────────────────────────────────────────

  function initSearch() {
    const input = document.getElementById("search-input");
    if (!input) return;
    let debounce;
    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        searchQuery = input.value.trim();
        render();
      }, 220);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init() {
    const dataEl = document.getElementById("catalog-data");
    if (!dataEl) return;

    try {
      allProducts = JSON.parse(dataEl.textContent || "[]");
    } catch {
      allProducts = [];
    }

    buildFilters();
    initSearch();
    render();
  }

  // Wait for DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
