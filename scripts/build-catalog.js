// Fetches the Google Sheet + Drive image folder, writes catalog.json,
// and injects SEO data into index.html. Run via GitHub Actions hourly.
// Required env var: DRIVE_API_KEY

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const settings = JSON.parse(readFileSync(resolve(ROOT, 'settings.json'), 'utf8'));
const API_KEY = process.env.DRIVE_API_KEY;

// ── Sheet ─────────────────────────────────────────────────────────────────────

async function fetchSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${settings.sheetId}/export?format=csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return res.text();
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').trim().split('\n');
  return lines.slice(1).map(line => {
    const c = parseCSVLine(line);
    return {
      id:              c[0]?.trim() || '',
      title:           c[1]?.trim() || '',
      price:           parseFloat(c[2]?.trim()) || 0,
      categories:      (c[3]?.trim() || '').split(',').map(s => s.trim()).filter(Boolean),
      description:     c[4]?.trim() || '',
      variations:      (c[5]?.trim() || '').split(',').map(s => s.trim()).filter(Boolean),
      variationPrices: (c[6]?.trim() || '').split(',').map(s => parseFloat(s.trim()) || 0).filter(n => n > 0),
    };
  }).filter(p => p.id);
}

// ── Drive ─────────────────────────────────────────────────────────────────────

async function fetchDriveFiles() {
  let files = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${settings.imageFolderId}' in parents and trashed = false`,
      key: API_KEY,
      fields: 'nextPageToken,files(id,name)',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
    if (!res.ok) throw new Error(`Drive API failed ${res.status}: ${await res.text()}`);
    const data = await res.json();
    files = files.concat(data.files || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return files;
}

function buildImageMap(files) {
  const map = {};
  for (const file of files) {
    // Expected filename format: ID-1.png  ID-2.jpg  ID-3.webp
    const match = file.name.match(/^(.+)-(\d+)\.(png|jpe?g|webp)$/i);
    if (!match) continue;
    const [, productId, idx] = match;
    if (!map[productId]) map[productId] = [];
    map[productId].push({ idx: parseInt(idx, 10), driveId: file.id });
  }
  for (const id of Object.keys(map)) {
    map[id].sort((a, b) => a.idx - b.idx);
  }
  return map;
}

const driveUrl = id => `https://drive.google.com/uc?export=view&id=${id}`;

// ── SEO injection ─────────────────────────────────────────────────────────────

function buildJsonLd(products) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.title,
        description: p.description,
        image: p.images[0] || '',
        offers: {
          '@type': 'Offer',
          price: p.price,
          priceCurrency: settings.currency,
          availability: 'https://schema.org/InStock',
        },
      },
    })),
  };
}

function injectSEO(products) {
  const indexPath = resolve(ROOT, 'index.html');
  if (!existsSync(indexPath)) {
    console.log('  index.html not found — skipping SEO injection (run again after creating it).');
    return;
  }

  const siteConfig = {
    storeName: settings.storeName,
    whatsappNumber: settings.whatsappNumber,
    currency: settings.currency,
    queueFolderUrl: settings.queueFolderUrl,
  };

  const block = [
    '<!-- CATALOG_DATA_START -->',
    `<script>window.__SITE__=${JSON.stringify(siteConfig)};</script>`,
    `<script type="application/json" id="catalog-data">${JSON.stringify({ products })}</script>`,
    `<script type="application/ld+json">${JSON.stringify(buildJsonLd(products))}</script>`,
    '<!-- CATALOG_DATA_END -->',
  ].join('\n');

  let html = readFileSync(indexPath, 'utf8');

  if (html.includes('<!-- CATALOG_DATA_START -->')) {
    html = html.replace(/<!-- CATALOG_DATA_START -->[\s\S]*?<!-- CATALOG_DATA_END -->/, block);
  } else {
    html = html.replace('</head>', `${block}\n</head>`);
  }

  writeFileSync(indexPath, html, 'utf8');
  console.log('  SEO data injected into index.html');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) throw new Error('DRIVE_API_KEY environment variable is not set');

  console.log('Fetching spreadsheet...');
  const products = parseCSV(await fetchSheet());
  console.log(`  ${products.length} products`);

  console.log('Fetching images from Drive...');
  const files = await fetchDriveFiles();
  console.log(`  ${files.length} image files`);

  const imageMap = buildImageMap(files);
  const enriched = products.map(p => ({
    ...p,
    images: (imageMap[p.id] || []).map(img => driveUrl(img.driveId)),
  }));

  const catalogPath = resolve(ROOT, 'catalog.json');
  const existing = existsSync(catalogPath)
    ? JSON.parse(readFileSync(catalogPath, 'utf8'))
    : null;

  if (existing && JSON.stringify(existing.products) === JSON.stringify(enriched)) {
    console.log('No changes — catalog is up to date.');
    return;
  }

  console.log('Changes detected — writing catalog.json...');
  writeFileSync(catalogPath, JSON.stringify({ updated: new Date().toISOString(), products: enriched }, null, 2), 'utf8');
  injectSEO(enriched);
  console.log('Done.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
