"use strict";

/**
 * main.js
 *
 * Handles:
 *  - Settings injection (from SETTINGS global in settings.js)
 *  - Navbar (scroll behavior, mobile menu)
 *  - Hero carousel
 *  - Cart (localStorage, add/remove/qty, sidebar)
 *  - WhatsApp button (with cart summary)
 *  - File upload to Google Drive (OAuth 2.0 via GIS)
 */

(function () {
  /* ── Abort if settings.js not loaded ──────────────────────────────────── */
  if (typeof SETTINGS === "undefined") {
    console.error("[FlowerSt] settings.js not loaded.");
    return;
  }

  const S = SETTINGS;

  /* ── Helpers ─────────────────────────────────────────────────────────── */

  function qs(sel, ctx = document) { return ctx.querySelector(sel); }
  function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

  function formatPrice(raw) {
    if (!raw) return "";
    const n = parseFloat(String(raw).replace(/[^\d.,]/g, "").replace(",", "."));
    if (isNaN(n)) return String(raw);
    return "$ " + n.toLocaleString("es-AR");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  /* ── Apply settings to page ──────────────────────────────────────────── */

  function applySettings() {
    // Title & meta
    document.title = S.storeName || "Flower St";
    const descMeta = qs('meta[name="description"]');
    if (descMeta) descMeta.content = S.storeTagline || "";

    // Footer email
    const emailLinks = qsa(".footer-email");
    emailLinks.forEach((el) => {
      el.href = `mailto:${S.storeEmail}`;
      el.textContent = S.storeEmail;
    });

    // Info cards
    const infoGrid = qs(".info-grid");
    if (infoGrid && S.infoBlocks && S.infoBlocks.length) {
      infoGrid.innerHTML = S.infoBlocks
        .map(
          (b) => `
          <div class="info-card">
            <div class="info-card-icon">${b.icon || "✨"}</div>
            <h3>${b.title || ""}</h3>
            <p>${b.text || ""}</p>
          </div>`
        )
        .join("");
    }

    // About
    const aboutTitle = qs(".about-title");
    const aboutBody = qs(".about-body");
    if (aboutTitle) aboutTitle.textContent = S.aboutTitle || "";
    if (aboutBody) aboutBody.textContent = S.aboutText || "";

    const aboutImg = qs(".about-image-content");
    if (aboutImg && S.aboutImage) {
      aboutImg.innerHTML = `<img src="${S.aboutImage}" alt="Flower St" loading="lazy">`;
    }
  }

  /* ── Navbar ──────────────────────────────────────────────────────────── */

  function initNavbar() {
    const navbar = qs(".navbar");
    if (!navbar) return;

    // Scroll behavior
    function onScroll() {
      if (window.scrollY > 20) {
        navbar.classList.add("scrolled");
        navbar.classList.remove("at-top");
      } else {
        navbar.classList.remove("scrolled");
        navbar.classList.add("at-top");
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Mobile menu
    const hamburger = qs(".hamburger");
    const mobileMenu = qs(".mobile-menu");
    if (hamburger && mobileMenu) {
      hamburger.addEventListener("click", () => {
        const open = mobileMenu.classList.toggle("open");
        hamburger.setAttribute("aria-expanded", open);
        hamburger.classList.toggle("active", open);
      });

      // Close when a link is clicked
      qsa(".mobile-menu .nav-link, .mobile-menu .cart-toggle", mobileMenu).forEach((el) => {
        el.addEventListener("click", () => {
          mobileMenu.classList.remove("open");
          hamburger.setAttribute("aria-expanded", "false");
          hamburger.classList.remove("active");
        });
      });
    }
  }

  /* ── Carousel ────────────────────────────────────────────────────────── */

  function initCarousel() {
    const slides = S.carouselSlides || [];
    if (!slides.length) return;

    const track = qs(".carousel-track");
    const dotsContainer = qs(".carousel-dots");
    const prevBtn = qs(".carousel-btn.prev");
    const nextBtn = qs(".carousel-btn.next");
    if (!track) return;

    let current = 0;
    let autoplayTimer;

    // Build slides
    track.innerHTML = slides
      .map(
        (s) => `
        <div class="carousel-slide">
          ${s.image ? `<div class="carousel-slide-bg" style="background-image:url('${s.image}')"></div>` : ""}
          <div class="carousel-slide-overlay"></div>
          <div class="carousel-slide-content">
            <h2>${s.title || ""}</h2>
            ${s.subtitle ? `<p>${s.subtitle}</p>` : ""}
            <a href="#catalog" class="btn btn-primary">Ver catálogo</a>
          </div>
        </div>`
      )
      .join("");

    // Build dots
    if (dotsContainer) {
      dotsContainer.innerHTML = slides
        .map((_, i) => `<button class="carousel-dot${i === 0 ? " active" : ""}" data-index="${i}" aria-label="Slide ${i + 1}"></button>`)
        .join("");
    }

    function goTo(idx) {
      current = (idx + slides.length) % slides.length;
      track.style.transform = `translateX(-${current * 100}%)`;
      qsa(".carousel-dot").forEach((d, i) => d.classList.toggle("active", i === current));
    }

    function startAutoplay() {
      clearInterval(autoplayTimer);
      autoplayTimer = setInterval(() => goTo(current + 1), 5000);
    }

    prevBtn && prevBtn.addEventListener("click", () => { goTo(current - 1); startAutoplay(); });
    nextBtn && nextBtn.addEventListener("click", () => { goTo(current + 1); startAutoplay(); });

    if (dotsContainer) {
      dotsContainer.addEventListener("click", (e) => {
        const dot = e.target.closest(".carousel-dot");
        if (dot) { goTo(Number(dot.dataset.index)); startAutoplay(); }
      });
    }

    // Touch swipe
    let touchStartX = 0;
    track.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", (e) => {
      const dx = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 40) { goTo(dx > 0 ? current + 1 : current - 1); startAutoplay(); }
    });

    startAutoplay();
  }

  /* ── Cart ────────────────────────────────────────────────────────────── */

  const CART_KEY = "flowerst_cart";

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function cartTotal(cart) {
    return cart.reduce((sum, item) => {
      // item.price is always the raw spreadsheet value ("10000"), never the
      // formatted display string, so a plain parseFloat is safe here.
      const n = parseFloat(String(item.price).replace(/[^\d.]/g, ""));
      return sum + (isNaN(n) ? 0 : n * item.qty);
    }, 0);
  }

  function renderCartItems(cart) {
    const container = qs(".cart-items");
    const totalEl = qs(".cart-total-amount");
    const badge = qs(".cart-badge");
    const floatIndicator = qs(".whatsapp-float .cart-indicator");
    if (!container) return;

    const totalCount = cart.reduce((s, i) => s + i.qty, 0);

    // Update badges
    if (badge) badge.textContent = totalCount;
    if (floatIndicator) {
      floatIndicator.textContent = totalCount;
      floatIndicator.classList.toggle("show", totalCount > 0);
    }

    if (totalEl) {
      totalEl.textContent = formatPrice(cartTotal(cart)) || "$ 0";
    }

    if (!cart.length) {
      container.innerHTML = `
        <div class="cart-empty">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <p>Tu carrito está vacío</p>
        </div>`;
      return;
    }

    container.innerHTML = cart
      .map(
        (item) => `
        <div class="cart-item" data-key="${item.key}">
          <div class="cart-item-image">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" loading="lazy">` : "🌸"}
          </div>
          <div class="cart-item-details">
            <div class="cart-item-name">${item.name}</div>
            ${item.variant ? `<div class="cart-item-variant">${item.variant}</div>` : ""}
            <div class="cart-item-row">
              <span class="cart-item-price">${formatPrice(item.price)}</span>
              <div class="qty-controls">
                <button class="qty-btn qty-minus" data-key="${item.key}">−</button>
                <span class="qty-value">${item.qty}</span>
                <button class="qty-btn qty-plus"  data-key="${item.key}">+</button>
              </div>
              <button class="cart-remove" data-key="${item.key}" aria-label="Eliminar">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>`
      )
      .join("");
  }

  function openCart() {
    qs(".cart-sidebar")?.classList.add("open");
    qs(".cart-overlay")?.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeCart() {
    qs(".cart-sidebar")?.classList.remove("open");
    qs(".cart-overlay")?.classList.remove("open");
    document.body.style.overflow = "";
  }

  function addToCart(product) {
    const cart = loadCart();
    const key = product.id + (product.variant ? `:${product.variant}` : "");
    const existing = cart.find((i) => i.key === key);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ key, id: product.id, name: product.name, variant: product.variant || "", price: product.price, image: product.image, qty: 1 });
    }
    saveCart(cart);
    renderCartItems(cart);

    // Bump animation
    const badge = qs(".cart-badge");
    if (badge) { badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
  }

  function initCart() {
    const cart = loadCart();
    renderCartItems(cart);

    // Open / close (attach to ALL .cart-toggle buttons: navbar + mobile menu)
    qsa(".cart-toggle").forEach((btn) => btn.addEventListener("click", openCart));
    qs(".cart-close")?.addEventListener("click", closeCart);
    qs(".cart-overlay")?.addEventListener("click", closeCart);

    // Delegation for qty and remove buttons inside cart sidebar
    qs(".cart-items")?.addEventListener("click", (e) => {
      const key = e.target.closest("[data-key]")?.dataset.key;
      if (!key) return;

      let cart = loadCart();

      if (e.target.closest(".qty-minus")) {
        const item = cart.find((i) => i.key === key);
        if (item) { item.qty -= 1; if (item.qty <= 0) cart = cart.filter((i) => i.key !== key); }
      } else if (e.target.closest(".qty-plus")) {
        const item = cart.find((i) => i.key === key);
        if (item) item.qty += 1;
      } else if (e.target.closest(".cart-remove")) {
        cart = cart.filter((i) => i.key !== key);
      }

      saveCart(cart);
      renderCartItems(cart);
    });

    // "Add to cart" buttons (event delegation from body)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".add-to-cart");
      if (!btn) return;

      const variantBtn = document.querySelector(`.variant-btn.selected[data-id="${btn.dataset.id}"]`);
      const variant = variantBtn ? variantBtn.dataset.name : (btn.dataset.variant || "");
      const price = variantBtn ? variantBtn.dataset.price : btn.dataset.price;

      addToCart({
        id: btn.dataset.id,
        name: btn.dataset.name,
        variant,
        price,
        image: btn.dataset.image || "",
      });

      // Briefly label button
      const orig = btn.innerHTML;
      btn.textContent = "✓ Agregado";
      btn.disabled = true;
      setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 1400);
    });
  }

  /* ── WhatsApp ─────────────────────────────────────────────────────────── */

  function buildWhatsAppUrl(cart) {
    const phone = (S.whatsappPhone || "").replace(/\D/g, "");
    let msg = S.whatsappGreeting || "Hola!";

    if (cart && cart.length) {
      msg += "\n\n*Mi carrito:*\n";
      cart.forEach((item) => {
        msg += `• ${item.name}`;
        if (item.variant) msg += ` (${item.variant})`;
        msg += ` x${item.qty}`;
        if (item.price) msg += ` – ${formatPrice(item.price)}`;
        msg += "\n";
      });
      const total = cartTotal(cart);
      if (total > 0) msg += `\n*Total: ${formatPrice(total)}*`;
    }

    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }

  function initWhatsApp() {
    function refresh() {
      const cart = loadCart();
      const url = buildWhatsAppUrl(cart);

      // Floating button
      const floatBtn = qs(".whatsapp-float");
      if (floatBtn) floatBtn.href = url;

      // Cart sidebar button
      const cartWaBtn = qs(".btn-whatsapp");
      if (cartWaBtn) cartWaBtn.href = url;
    }

    refresh();

    // Re-evaluate when cart changes
    window.addEventListener("storage", (e) => { if (e.key === CART_KEY) refresh(); });

    // Also hook into cart item interactions so same-tab updates propagate
    document.addEventListener("click", (e) => {
      if (e.target.closest(".add-to-cart, .qty-btn, .cart-remove")) {
        setTimeout(refresh, 50);
      }
    });
  }

  /* ── Google Drive file upload ─────────────────────────────────────────── */

  let gisClient = null;
  let accessToken = null;
  let pendingFiles = [];

  function initUpload() {
    const area     = qs(".upload-area");
    const input    = qs("#file-input");
    const fileList = qs(".upload-file-list");
    const uploadBtn = qs("#upload-btn");
    const progressBar  = qs(".upload-progress-fill");
    const progressWrap = qs(".upload-progress-bar");
    const statusEl = qs(".upload-status");

    if (!area) return;

    function setStatus(msg, type = "") {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = "upload-status" + (type ? ` ${type}` : "");
    }

    function renderFileList() {
      if (!fileList) return;
      if (!pendingFiles.length) { fileList.innerHTML = ""; return; }
      fileList.innerHTML = pendingFiles
        .map(
          (f, i) => `
          <div class="upload-file-item">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
            <span class="upload-file-name">${f.name}</span>
            <span class="upload-file-size">${formatBytes(f.size)}</span>
            <button class="upload-remove-btn" data-index="${i}" aria-label="Quitar">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>`
        )
        .join("");

      fileList.querySelectorAll(".upload-remove-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          pendingFiles.splice(Number(btn.dataset.index), 1);
          renderFileList();
        });
      });
    }

    // The <label for="file-input"> in the HTML handles opening the picker.
    // We only need to listen for the change event here.
    input.addEventListener("change", () => {
      pendingFiles = [...pendingFiles, ...Array.from(input.files)];
      input.value = "";
      renderFileList();
    });

    // Drag-and-drop onto the label/area
    area.addEventListener("dragover", (e) => { e.preventDefault(); area.classList.add("dragover"); });
    area.addEventListener("dragleave", () => area.classList.remove("dragover"));
    area.addEventListener("drop", (e) => {
      e.preventDefault();
      area.classList.remove("dragover");
      pendingFiles = [...pendingFiles, ...Array.from(e.dataTransfer.files)];
      renderFileList();
    });

    // Upload button — starts Drive upload (files must already be selected)
    if (uploadBtn) {
      uploadBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault(); // prevent label from re-opening picker

        if (!pendingFiles.length) {
          setStatus("Primero seleccioná archivos haciendo clic en el área de arriba.", "error");
          return;
        }

        const clientId = S.googleClientId;
        if (!clientId || clientId.includes("YOUR_GOOGLE_CLIENT_ID")) {
          // Fallback: open the Drive folder so the user can upload manually
          setStatus("⚠️ Carga automática no configurada. Abriendo carpeta de Drive…", "error");
          setTimeout(() => window.open(`https://drive.google.com/drive/folders/${S.uploadFolderId}`, "_blank"), 1200);
          return;
        }

        setStatus("Autenticando con Google…");
        uploadBtn.disabled = true;

        try {
          accessToken = await getGoogleToken(clientId);
        } catch {
          setStatus("❌ Autenticación cancelada o fallida.", "error");
          uploadBtn.disabled = false;
          return;
        }

        const total = pendingFiles.length;
        let done = 0;

        if (progressWrap) progressWrap.style.display = "block";

        for (const file of pendingFiles) {
          setStatus(`Subiendo ${file.name}…`);
          try {
            await uploadFileToDrive(file, S.uploadFolderId, accessToken);
            done++;
            if (progressBar) progressBar.style.width = `${(done / total) * 100}%`;
          } catch (err) {
            console.error("[upload]", err);
            setStatus(`❌ Error al subir ${file.name}: ${err.message}`, "error");
            uploadBtn.disabled = false;
            return;
          }
        }

        pendingFiles = [];
        renderFileList();
        setStatus(`✅ ${total} archivo${total > 1 ? "s" : ""} subido${total > 1 ? "s" : ""} correctamente!`, "success");
        uploadBtn.disabled = false;
        if (progressBar) setTimeout(() => { progressBar.style.width = "0%"; if (progressWrap) progressWrap.style.display = "none"; }, 2000);
      });
    }
  }

  function getGoogleToken(clientId) {
    return new Promise((resolve, reject) => {
      if (accessToken) return resolve(accessToken);

      if (typeof google === "undefined" || !google.accounts) {
        reject(new Error("Google Identity Services not loaded"));
        return;
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (resp) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          accessToken = resp.access_token;
          resolve(accessToken);
        },
      });

      client.requestAccessToken({ prompt: "consent" });
    });
  }

  async function uploadFileToDrive(file, folderId, token) {
    const metadata = { name: file.name, parents: folderId ? [folderId] : [] };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
      { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    return res.json();
  }

  /* ── Boot ─────────────────────────────────────────────────────────────── */

  function boot() {
    applySettings();
    initNavbar();
    initCarousel();
    initCart();
    initWhatsApp();
    initUpload();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
