#!/usr/bin/env node
/**
 * fetch-catalog.js
 *
 * Fetches the product catalog from a public Google Sheets CSV export,
 * parses it, then patches two things in src/index.html:
 *
 *   1. <script id="catalog-data" type="application/json">  ← product JSON array
 *   2. <script id="structured-data" type="application/ld+json">  ← JSON-LD for SEO
 *
 * Spreadsheet column layout:
 *   A: Name   B: Price   C: Category   D: Description   E: Image URL
 *   F+G, H+I, … : variant name / variant price pairs
 *
 * Run: node scripts/fetch-catalog.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ── Load settings ──────────────────────────────────────────────────────────
// Tiny inline require that avoids a module system mismatch with the browser
// settings.js (which assigns to a global). We read it as text and eval.
const settingsPath = path.resolve(__dirname, "../settings.js");
const settingsCode = fs.readFileSync(settingsPath, "utf8");
// Provide a mock global so the file can assign to `const SETTINGS`
let SETTINGS;
{
  const capture = new Function("return (" + settingsCode.replace(/^const SETTINGS =/, "").replace(/;?\s*$/, "") + ")");
  SETTINGS = capture();
}

const SHEET_ID = SETTINGS.spreadsheetId;
if (!SHEET_ID) {
  console.error("❌  spreadsheetId is not set in settings.js");
  process.exit(1);
}

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
const INDEX_HTML = path.resolve(__dirname, "../src/index.html");
const STORE_NAME = SETTINGS.storeName || "Flower St";
const STORE_EMAIL = SETTINGS.storeEmail || "";

// ── CSV parser (no external deps) ─────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field.trim()); field = ""; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        row.push(field.trim());
        if (row.some(Boolean)) rows.push(row);
        row = []; field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field || row.length) { row.push(field.trim()); if (row.some(Boolean)) rows.push(row); }

  return rows;
}

// ── Drive URL → direct image URL ───────────────────────────────────────────
function normalizeDriveUrl(url) {
  if (!url) return "";
  const m = url.match(/\/file\/d\/([-\w]+)/);
  if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  const m2 = url.match(/[?&]id=([-\w]+)/);
  if (m2) return `https://drive.google.com/uc?export=view&id=${m2[1]}`;
  return url;
}

// ── Rows → product objects ─────────────────────────────────────────────────
function rowsToProducts(rows) {
  // No header row — all rows are products.
  // If the first cell of the first row looks like a column label, skip it.
  const firstCell = (rows[0]?.[0] || "").toLowerCase().trim();
  const hasHeader = firstCell === "name" || firstCell === "nombre" || firstCell === "product";
  return rows.slice(hasHeader ? 1 : 0).flatMap((cols, idx) => {
    const name = cols[0] || "";
    if (!name) return [];

    const price = cols[1] || "";
    const category = cols[2] || "";
    const description = cols[3] || "";
    const imageUrl = normalizeDriveUrl(cols[4] || "");

    const variants = [];
    for (let c = 5; c < cols.length - 1; c += 2) {
      const varName = cols[c];
      const varPrice = cols[c + 1];
      if (varName) variants.push({ name: varName, price: varPrice || "" });
    }

    return [{ id: idx + 1, name, price, category, description, imageUrl, variants }];
  });
}

// ── JSON-LD structured data ────────────────────────────────────────────────
function buildJsonLd(products) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Store",
        name: STORE_NAME,
        email: STORE_EMAIL,
      },
      ...products.map((p) => ({
        "@type": "Product",
        name: p.name,
        description: p.description,
        image: p.imageUrl || undefined,
        category: p.category || undefined,
        offers: {
          "@type": "Offer",
          price: p.price.replace(/[^0-9.,]/g, "") || undefined,
          priceCurrency: "ARS",
        },
      })),
    ],
  };
}

// ── Patch index.html ───────────────────────────────────────────────────────
function patchHtml(html, products) {
  const catalogJson = JSON.stringify(products, null, 2);
  const ldJson = JSON.stringify(buildJsonLd(products), null, 2);

  // Replace catalog-data block
  html = html.replace(
    /(<script\s+id="catalog-data"\s+type="application\/json">)([\s\S]*?)(<\/script>)/,
    `$1\n${catalogJson}\n$3`
  );

  // Replace structured-data block
  html = html.replace(
    /(<script\s+id="structured-data"\s+type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
    `$1\n${ldJson}\n$3`
  );

  return html;
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log(`🌸  Fetching catalog from Google Sheets (id: ${SHEET_ID})…`);

  let csvText;
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
    csvText = await res.text();
  } catch (err) {
    console.error("❌  Failed to fetch spreadsheet:", err.message);
    process.exit(1);
  }

  const rows = parseCsv(csvText);
  const products = rowsToProducts(rows);
  console.log(`✅  Parsed ${products.length} products`);

  let html;
  try {
    html = fs.readFileSync(INDEX_HTML, "utf8");
  } catch {
    console.error("❌  Could not read src/index.html");
    process.exit(1);
  }

  const patched = patchHtml(html, products);
  fs.writeFileSync(INDEX_HTML, patched, "utf8");
  console.log(`📝  Updated src/index.html with catalog data`);
  console.log("🎉  Done!");
})();
