# Flower St — E-commerce Website

A static e-commerce site for a print shop. The product catalog syncs automatically from a Google Sheets spreadsheet via GitHub Actions. Images are lazy-loaded from Google Drive. Clients contact the store through WhatsApp.

---

## Project structure

```
flowerst/
├── src/
│   ├── index.html          ← main page (deploy this folder)
│   ├── css/style.css
│   └── js/
│       ├── catalog.js      ← product rendering & lazy-loading
│       └── main.js         ← carousel, cart, WhatsApp, file upload
├── img/                    ← local images (logo, about photo, etc.)
├── scripts/
│   └── fetch-catalog.js    ← build script: fetches CSV → patches index.html
├── .github/workflows/
│   └── sync-catalog.yml    ← GitHub Action: runs fetch-catalog daily
├── settings.js             ← ★ ALL configuration lives here
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
| `uploadFolderId` | Google Drive folder ID for client file uploads |
| `googleClientId` | OAuth 2.0 Client ID (see Drive upload setup below) |
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

The "Subir archivos" section lets visitors upload files directly to the configured Drive folder. This uses **Google OAuth 2.0** in the browser — no backend required.

### Setup (one time)

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project (or select an existing one).
3. Enable the **Google Drive API**.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
   - Application type: **Web application**
   - Authorized JavaScript origins: add your production domain (e.g. `https://flowerst.com`) AND `http://localhost:3000` for local dev.
5. Copy the **Client ID** and paste it into `settings.js` → `googleClientId`.
6. Share the target Drive folder with the visitors (or keep it private — users will auth with their own Google account to upload into your folder via the Drive API scope `drive.file`, which only allows access to files the app itself creates).

> **Note:** `drive.file` scope means visitors can only write to your folder, not read anything else in your Drive.

---

## Deployment

The `src/` folder is a self-contained static site. Deploy it to any static host:

- **GitHub Pages** — point Pages to the `src/` folder or use the `gh-pages` branch.
- **Netlify / Vercel** — set the publish directory to `src/`.
- **Any web server** — upload the contents of `src/` to the document root.

Make sure `settings.js` is served from the **parent directory** of `src/` (i.e. one level up), since `index.html` loads it as `../settings.js`.

Alternatively, move `settings.js` inside `src/` and update the `<script>` tag path in `index.html`.

---

## Adding a logo

Drop your logo image into `img/logo.png` (or any format), then in `src/index.html` replace the `.nav-logo-text` span with:

```html
<img src="../img/logo.png" alt="Flower St" class="nav-logo-img">
```

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
