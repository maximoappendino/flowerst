# Flower St — E-commerce Website

A static e-commerce site for a print shop. The product catalog syncs automatically from a Google Sheets spreadsheet via GitHub Actions. Images are lazy-loaded from Google Drive. Clients contact the store through WhatsApp. File uploads from customers go directly to a Google Drive folder via a Netlify serverless function.

---

## Project structure

```
flowerst/
├── src/
│   ├── index.html          ← main page + all SETTINGS live here
│   ├── css/style.css
│   ├── img/                ← local images (logo, about photo, etc.)
│   └── js/
│       ├── catalog.js      ← product rendering & lazy-loading
│       └── main.js         ← carousel, cart, WhatsApp, file upload
├── netlify/
│   └── functions/
│       ├── upload.js       ← handles customer file uploads → Google Drive
│       └── auth-callback.js← one-time OAuth flow to get refresh token
├── img/                    ← local images (logo, about photo, etc.)
├── scripts/
│   └── fetch-catalog.js    ← build script: fetches CSV → patches index.html
├── .github/workflows/
│   └── sync-catalog.yml    ← GitHub Action: runs fetch-catalog daily
├── netlify.toml            ← publish dir + functions dir config
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

## Configuration

All settings are in the `<script>` block at the bottom of `src/index.html`, just above the `catalog.js` and `main.js` script tags. Look for the comment:

```
<!-- SETTINGS — edit these values to customise the store. -->
```

| Key | Description |
|-----|-------------|
| `storeName` | Store display name |
| `storeEmail` | Contact email shown in footer |
| `whatsappPhone` | WhatsApp number with country code, e.g. `+541112345678` |
| `spreadsheetId` | Google Sheets ID from the URL |
| `uploadFolderId` | Google Drive folder ID for customer file uploads |
| `googleClientId` | OAuth 2.0 Client ID — needed only for the one-time auth button |
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

Fetches the spreadsheet CSV and patches the `<script id="catalog-data">` and `<script id="structured-data">` tags in `src/index.html`. Commit the updated file.

### Automatic (GitHub Actions)

The workflow `.github/workflows/sync-catalog.yml` runs every day at 06:00 UTC and commits the updated `src/index.html` automatically.

Trigger it manually from **Actions → Sync Catalog → Run workflow**.

---

## Customer file uploads — architecture

Customers select files in the "Subir archivos" section. Each file is sent as a raw POST body to `/.netlify/functions/upload`. The function:

1. Exchanges the shopowner's stored **refresh token** for a fresh access token.
2. Uploads the file to Google Drive using the multipart upload API.
3. Returns a JSON response with the new file's Drive ID.

Customers never need a Google account.

> **File size limit:** Netlify functions accept up to ~6 MB per request. Files over 5 MB are rejected with an error message before the upload is attempted.

---

## Google Drive setup (one time)

### Step 1 — Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a project (or select an existing one).
3. Enable the **Google Drive API**.
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `https://YOUR-SITE.netlify.app/.netlify/functions/auth-callback`
     - `http://localhost:3000/.netlify/functions/auth-callback` (for local dev with Netlify CLI)
5. Copy the **Client ID** and **Client Secret**.

### Step 2 — Netlify environment variables (before the auth button is clicked)

In **Netlify → Site configuration → Environment variables**, add:

| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Client ID from step 1 |
| `GOOGLE_CLIENT_SECRET` | Client secret from step 1 |
| `UPLOAD_FOLDER_ID` | Google Drive folder ID (same as `uploadFolderId` in SETTINGS) |

Deploy the site after adding these.

### Step 3 — Put the Client ID in `index.html`

In the SETTINGS block of `src/index.html`, set:

```js
googleClientId: "YOUR_CLIENT_ID.apps.googleusercontent.com",
```

### Step 4 — Authorize (shopowner clicks the button)

1. Open the live site and scroll to **Subir archivos**.
2. The shopowner clicks **"Conectar Google Drive"**.
3. Google's consent screen opens — she approves.
4. The `auth-callback` function exchanges the code for tokens and shows a page with the **Refresh Token**.
5. Copy the refresh token.

### Step 5 — Store the refresh token

In Netlify env vars, add:

| Variable | Value |
|----------|-------|
| `GOOGLE_REFRESH_TOKEN` | Refresh token from step 4 |

Trigger a redeploy.

### Step 6 — Remove the auth button

Delete the `<div id="client-auth-section">` block from `src/index.html`. The upload section will still work; the button is no longer needed.

---

## Deployment

The `src/` folder is a self-contained static site. `netlify.toml` already tells Netlify to publish `src/` and serve functions from `netlify/functions/`.

```
Netlify publish directory: src
Functions directory:        netlify/functions
```

For local function testing, install the [Netlify CLI](https://docs.netlify.com/cli/get-started/) and run:

```bash
netlify dev
```

---

## Adding a logo

Drop your logo image into `img/logo.png` (or any format). The `<img>` in the navbar already points to `../img/logo.jpeg` — update the path if needed.

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
