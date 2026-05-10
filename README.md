# Flower St — E-commerce Website

A static e-commerce site for a print shop. The product catalog syncs automatically from a Google Sheets spreadsheet via GitHub Actions. Images are lazy-loaded from Google Drive. Clients contact the store through WhatsApp.

---

## Project structure

```
flowerst/
├── src/
│   ├── index.html          ← main page (deploy this folder)
│   ├── settings.js         ← ★ ALL configuration lives here
│   ├── css/style.css
│   ├── img/                ← local images (logo, about photo, etc.)
│   └── js/
│       ├── catalog.js      ← product rendering & lazy-loading
│       └── main.js         ← carousel, cart, WhatsApp, file upload
├── scripts/
│   └── fetch-catalog.js    ← build script: fetches CSV → patches index.html
├── .github/workflows/
│   └── sync-catalog.yml    ← GitHub Action: runs fetch-catalog daily
├── package.json
└── README.md
```

---

## Quick start (local development)

```bash
npm install        # installs http-server
npm run build      # fetch catalog from Google Sheets → update src/index.html
npm start          # serve src/ at http://localhost:3000
```

> **Node ≥ 18** required (uses built-in `fetch`).

---

## Configuration — `settings.js`

Open `settings.js` and fill in every field:

| Key | Description |
|-----|-------------|
| `storeName` | Store display name |
| `storeEmail` | Contact email shown in footer |
| `whatsappPhone` | WhatsApp number with country code, e.g. `+541112345678` |
| `spreadsheetId` | Google Sheets ID from the URL |
| `uploadFolderId` | Google Drive folder ID embedded in the upload modal |
| `carouselSlides` | Array of `{ image, title, subtitle }` for the hero carousel |
| `infoBlocks` | Feature cards below the carousel |
| `aboutText` | About section body text |

---

## Catalog spreadsheet format

The spreadsheet must be shared as **"Anyone with the link can view"**.

| Column | Field |
|--------|-------|
| A | Product name |
| B | Base price |
| C | Category |
| D | Description |
| E | Image URL (Google Drive share link or direct URL) |
| F | Variant 1 name |
| G | Variant 1 price |
| H | Variant 2 name |
| I | Variant 2 price |
| … | more variant pairs |

**Google Drive image links** (share links like `drive.google.com/file/d/…`) are automatically converted to direct image URLs.

---

## Catalog sync

### Manual

```bash
npm run build
```

This fetches the spreadsheet CSV and patches the `<script id="catalog-data">` and `<script id="structured-data">` tags in `src/index.html` with the latest data. Commit the updated file.

### Automatic (GitHub Actions)

The workflow `.github/workflows/sync-catalog.yml` runs every day at 06:00 UTC and commits the updated `src/index.html` automatically.

You can also trigger it manually from **Actions → Sync Catalog → Run workflow**.

---

## File upload to Google Drive

The "Subir archivos" button in the navbar opens a modal with your Google Drive folder **embedded directly** as an iframe. Visitors can browse the folder and click **Abrir en Google Drive** to upload files from their own Google account.

### Setup (one time)

1. Go to your Drive folder and click **Share**.
2. Under "General access", set it to **"Anyone with the link"** and choose **"Contributor"** (or **"Editor"**) so visitors can upload files.
3. Copy the folder ID from the URL (the long string after `/folders/`) and paste it into `src/settings.js` → `uploadFolderId`. The iframe and the open-link will update automatically.

> The folder ID is already pre-filled with the test folder. Replace it with your own folder's ID before going live.

---

## Deployment

The `src/` folder is a self-contained static site. Deploy it to any static host:

- **GitHub Pages** — point Pages to the `src/` folder or use the `gh-pages` branch.
- **Netlify / Vercel** — set the publish directory to `src/`.
- **Any web server** — upload the contents of `src/` to the document root.

`settings.js` lives inside `src/` alongside `index.html`, so no special path configuration is needed.

---

## Adding a logo

Drop your logo file into `src/img/` (e.g. `src/img/logo.jpeg`). The navbar already references `img/logo.jpeg` and falls back to the store name text if the file is missing.

---

## Changing the color palette

All colors are CSS custom properties at the top of `src/css/style.css`:

```css
:root {
  --rose-400: #E07095;   /* primary accent */
  --sage-400: #7FAF8C;   /* secondary accent */
  --cream:    #FDF6F0;   /* page background */
  --dark:     #2D1F28;   /* headings / footer */
  /* … */
}
```
