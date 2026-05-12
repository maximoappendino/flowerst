# Flower St — Developer Guide

A static e-commerce site for print shops. Product catalog syncs from Google Sheets. Customers upload files directly to the client's Google Drive via a Netlify serverless function — no Google account required from the customer side.

---

## Table of contents

1. [How it works (quick overview)](#1-how-it-works-quick-overview)
2. [Project structure](#2-project-structure)
3. [Replicating for a new client — step by step](#3-replicating-for-a-new-client--step-by-step)
   - [Step A — Copy the codebase](#step-a--copy-the-codebase)
   - [Step B — Customize the store settings](#step-b--customize-the-store-settings)
   - [Step C — Set up the product catalog (Google Sheets)](#step-c--set-up-the-product-catalog-google-sheets)
   - [Step D — Deploy to Netlify](#step-d--deploy-to-netlify)
   - [Step E — Google Cloud project (reuse or create)](#step-e--google-cloud-project-reuse-or-create)
   - [Step F — Set Netlify environment variables](#step-f--set-netlify-environment-variables)
   - [Step G — Authorize the client's Google Drive](#step-g--authorize-the-clients-google-drive)
   - [Step H — Store the refresh token & redeploy](#step-h--store-the-refresh-token--redeploy)
   - [Step I — Remove the auth button](#step-i--remove-the-auth-button)
   - [Step J — Enable automatic catalog sync](#step-j--enable-automatic-catalog-sync)
4. [SETTINGS reference](#4-settings-reference)
5. [Netlify environment variables reference](#5-netlify-environment-variables-reference)
6. [Catalog spreadsheet format](#6-catalog-spreadsheet-format)
7. [Local development](#7-local-development)
8. [Changing the color palette](#8-changing-the-color-palette)

---

## 1. How it works (quick overview)

```
Customer browser
  │
  ├─► Views products ──► loaded from <script id="catalog-data"> in index.html
  │                       (populated by fetch-catalog.js / GitHub Action)
  │
  ├─► Adds to cart ──► localStorage only, no server needed
  │
  ├─► WhatsApp order ──► opens wa.me link with cart summary pre-filled
  │
  └─► Uploads files ──► POST /.netlify/functions/upload
                          │
                          └─► Netlify function uses the stored refresh token
                              to upload directly to the client's Google Drive folder
                              (customer never needs a Google account)
```

**Key idea for file uploads:** The *shopowner* authorizes once (by clicking a button you temporarily leave in the site). Google returns a long-lived refresh token. You store that token in Netlify. From then on, every customer upload goes through the server function — no Google login popup for customers ever.

---

## 2. Project structure

```
flowerst/
├── src/
│   ├── index.html          ← single page — all SETTINGS live here too
│   ├── css/style.css
│   ├── img/                ← local images (logo, about photo, etc.)
│   └── js/
│       ├── catalog.js      ← renders product grid, lazy-loads images
│       └── main.js         ← carousel, cart, WhatsApp, file upload modal
├── netlify/
│   └── functions/
│       ├── upload.js       ← receives file → uploads to Google Drive
│       └── auth-callback.js← one-time OAuth flow to capture the refresh token
├── scripts/
│   └── fetch-catalog.js    ← build script: fetches Google Sheet CSV → patches index.html
├── .github/workflows/
│   └── sync-catalog.yml    ← runs fetch-catalog.js daily and commits the result
├── netlify.toml            ← publish dir, functions dir, Node version
├── package.json
└── README.md
```

---

## 3. Replicating for a new client — step by step

### Step A — Copy the codebase

Option 1 — **GitHub template / fork**
If your repo is public, just fork it. If it's private, create a new repo and push a copy:

```bash
# Clone your existing repo into a new folder with the new client's name
git clone https://github.com/YOUR_USER/flowerst new-client-name
cd new-client-name

# Point it to a brand-new empty GitHub repo you created for this client
git remote set-url origin https://github.com/YOUR_USER/new-client-name
git push -u origin main
```

Option 2 — **Download a ZIP** from GitHub and `git init` fresh.

---

### Step B — Customize the store settings

All settings live in one place: the `<script>` block near the bottom of `src/index.html`, right before the `catalog.js` and `main.js` `<script>` tags. Look for:

```
const SETTINGS = {
```

Edit every value for the new client. See the [SETTINGS reference](#4-settings-reference) table for what each key does.

**Things you will definitely need to change:**
- `storeName`
- `storeEmail`
- `whatsappPhone`
- `spreadsheetId` (new sheet for this client — see Step C)
- `uploadFolderId` (new Drive folder for this client — see Step G)
- `googleClientId` (from Step E — same value if reusing the same Google project)
- `carouselSlides`, `infoBlocks`, `aboutTitle`, `aboutText`

> **Tip:** also update the `<meta name="description">` and `<title>` tags near the top of `index.html` with the new store name / tagline.

---

### Step C — Set up the product catalog (Google Sheets)

1. Create a new Google Spreadsheet for this client (or ask them to share one).
2. Format it according to the [catalog format](#6-catalog-spreadsheet-format) table below.
3. Share the sheet: **Share → Anyone with the link → Viewer**.
4. Copy the Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/  SHEET_ID_IS_HERE  /edit
   ```
5. Paste that ID into `SETTINGS.spreadsheetId` in `index.html`.
6. Run `npm run build` to pull the catalog into the HTML and verify it looks right.

---

### Step D — Deploy to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) and click **Add new site → Import an existing project**.
2. Connect to GitHub and pick the new client's repo.
3. Build settings — Netlify should detect `netlify.toml` automatically. If not, set manually:
   - **Base directory:** (leave empty)
   - **Build command:** (leave empty — no build command needed for the static site)
   - **Publish directory:** `src`
4. Click **Deploy site**. The site will be live at a random `*.netlify.app` URL.
5. Optionally add a custom domain later under **Domain settings**.

At this point the site is live but file uploads will not work yet (no credentials). Continue with the steps below.

---

### Step E — Google Cloud project (reuse or create)

#### Can you reuse the same Google Cloud project for multiple clients?

**Yes.** The Google Cloud project just provides the OAuth "app" identity (Client ID + Client Secret). You can use the same project for every client you deploy.

What is *per-client*:
- The **redirect URI** you add (one per Netlify site URL)
- The **refresh token** (tied to the specific Google account that authorized — i.e. the client's account)
- The **upload folder** (a folder in the client's Drive)

What is *shared* across all clients:
- `GOOGLE_CLIENT_ID` — same value everywhere
- `GOOGLE_CLIENT_SECRET` — same value everywhere

#### Adding a new client to the existing Google project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and open your existing project.
2. Navigate to **APIs & Services → Credentials**.
3. Click the OAuth 2.0 Client ID you already created (the one used for Flower St).
4. Under **Authorized redirect URIs**, click **Add URI** and add:
   ```
   https://NEW-CLIENT-SITE.netlify.app/.netlify/functions/auth-callback
   ```
   (Replace `NEW-CLIENT-SITE` with the actual Netlify subdomain.)
5. If you later add a custom domain, add that URI too:
   ```
   https://customdomain.com/.netlify/functions/auth-callback
   ```
6. Click **Save**.

#### If you need to create a fresh Google Cloud project

1. [console.cloud.google.com](https://console.cloud.google.com) → **New project**.
2. Enable the **Google Drive API**: **APIs & Services → Library → Google Drive API → Enable**.
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://NEW-CLIENT-SITE.netlify.app`
   - Authorized redirect URIs: `https://NEW-CLIENT-SITE.netlify.app/.netlify/functions/auth-callback`
4. Copy the **Client ID** and **Client Secret** — you'll need them in the next step.

> ⚠️ **Important:** "Authorized JavaScript origins" only accepts the bare domain (no path, no trailing slash). The full callback URL with `/.netlify/functions/auth-callback` goes into "Authorized redirect URIs" — those are different fields.

---

### Step F — Set Netlify environment variables

Go to your new Netlify site → **Site configuration → Environment variables** and add these four variables:

| Variable | Where to get it | Example |
|----------|----------------|---------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials | `850894441842-xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Same page, next to Client ID | `GOCSPX-xxxxxxxxxxxxxxxx` |
| `UPLOAD_FOLDER_ID` | Google Drive folder URL (the ID after `/folders/`) | `1-VcN-RfnFKbAgGn7CnPR3miqHpChGY-o` |
| `GOOGLE_REFRESH_TOKEN` | Obtained in Step G below — add this last | `1//01KZDck7XEV...` |

**How to get the Drive folder ID:**
The client creates a folder in their Google Drive and shares the link with you. The ID is the long string at the end:
```
https://drive.google.com/drive/folders/  THIS_IS_THE_FOLDER_ID
```

Also add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `SETTINGS.googleClientId` in `index.html` (the Client ID only — the secret stays server-side in Netlify).

After adding the variables, click **Deploys → Trigger deploy** so the function picks up the new values.

---

### Step G — Authorize the client's Google Drive

This step gets the `GOOGLE_REFRESH_TOKEN`. It is done **once** per client, using **the client's Google account** (not yours), because the refresh token authorizes access to *their* Drive.

1. **Send the live site URL to the client** and ask them to open it.
2. They should see the **"Conectar Google Drive"** button inside the "Subir archivos" modal. (It's only visible temporarily — you will remove it in Step I.)
3. The client clicks **"Conectar Google Drive"**.
4. Google's consent screen opens. The client logs in with the Google account that owns the Drive folder and clicks **Allow**.
5. They land on a page that shows the **Refresh Token** in a text box. It looks like:
   ```
   1//01KZDck7XEVxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. The client copies that token and sends it to you.

> **If the token box shows "(vacío — revocá el acceso...)"** it means Google didn't issue a refresh token because the app was previously authorized without offline access. Ask the client to go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions), find your app name, click **Remove access**, and then click the "Conectar Google Drive" button again.

> **If you want to test with your own Google account first** (before involving the client), just click the button yourself. The refresh token will let uploads go to whichever account authorized — so for the real launch, you'll need to redo this step with the client's account.

---

### Step H — Store the refresh token & redeploy

1. Go to **Netlify → Site configuration → Environment variables**.
2. Add (or update) `GOOGLE_REFRESH_TOKEN` with the token the client sent you.
3. Go to **Deploys → Trigger deploy** to apply the change.
4. Test the upload: open the site, pick a small file, click **Subir archivos**. You should see ✅ and the file should appear in the client's Drive folder.

---

### Step I — Remove the auth button

Once uploads are working, the "Conectar Google Drive" button is no longer needed. Remove it from `src/index.html`:

Find and delete this entire block (usually near the bottom of the upload modal):

```html
<!-- CLIENT AUTHORIZATION — TEMPORARY. Remove this <div> after Drive is connected. -->
<div id="client-auth-section" ...>
  <button ... id="btn-authorize-drive" ...>
    Conectar Google Drive
  </button>
</div>
```

Commit, push, done.

---

### Step J — Enable automatic catalog sync

The GitHub Action in `.github/workflows/sync-catalog.yml` runs `npm run build` every day at 06:00 UTC, commits the updated `index.html`, and pushes it. This keeps the product list in sync with the spreadsheet automatically.

For it to work, add a **repository secret** to the GitHub repo:

1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `GITHUB_TOKEN` — actually this is already provided automatically by GitHub Actions, you don't need to add it manually.

The workflow should work out of the box. You can trigger it manually from **GitHub → Actions → Sync Catalog → Run workflow** to test it.

> **Note:** If the spreadsheet has no public access, the fetch will fail. Make sure the sheet is shared as "Anyone with the link can view".

---

## 4. SETTINGS reference

All of these live inside `const SETTINGS = { ... }` near the bottom of `src/index.html`.

| Key | Type | Description |
|-----|------|-------------|
| `storeName` | string | Store display name — appears in the browser tab and footer |
| `storeEmail` | string | Contact email shown in the footer |
| `storeTagline` | string | Short tagline — used in the `<meta description>` tag |
| `whatsappPhone` | string | Full number with country code, no spaces: `+541112345678` |
| `whatsappGreeting` | string | Pre-filled message when customer taps the WhatsApp button |
| `spreadsheetId` | string | Google Sheets ID (from the spreadsheet URL) |
| `uploadFolderId` | string | Google Drive folder ID where customer files will be saved |
| `googleClientId` | string | OAuth 2.0 Client ID — needed for the one-time auth button |
| `carouselSlides` | array | Hero carousel slides: `{ image, title, subtitle }` |
| `infoBlocks` | array | Feature cards below the carousel: `{ icon, title, text }` |
| `aboutTitle` | string | Heading for the About section |
| `aboutText` | string | Body text for the About section |
| `aboutImage` | string | Optional path to a photo in the About section |

---

## 5. Netlify environment variables reference

Set these under **Netlify → Site configuration → Environment variables**.

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 Client Secret — never put this in HTML |
| `GOOGLE_REFRESH_TOKEN` | Yes | Long-lived token that authorizes uploads to the client's Drive. Obtained via the "Conectar Google Drive" button flow. |
| `UPLOAD_FOLDER_ID` | Recommended | Drive folder ID fallback. The browser also sends this from `SETTINGS.uploadFolderId`, so it is not strictly required — but setting it server-side is safer. |

After adding or changing any variable, always click **Deploys → Trigger deploy** so the running functions pick up the new values.

---

## 6. Catalog spreadsheet format

The spreadsheet must be shared as **"Anyone with the link can view"**.

| Column | Field | Notes |
|--------|-------|-------|
| A | Product name | Required |
| B | Base price | Any format: `$1.500`, `1500`, etc. |
| C | Category | e.g. `color`, `blanco y negro` |
| D | Description | Shown on the product card |
| E | Image URL | Google Drive share link or any direct URL |
| F | Variant 1 name | Optional |
| G | Variant 1 price | Optional |
| H | Variant 2 name | Optional |
| I | Variant 2 price | Optional |
| … | More variant pairs | Keep adding columns in pairs |

**Google Drive image links** like `drive.google.com/file/d/FILE_ID/view` are automatically converted to direct embeddable URLs by `fetch-catalog.js`.

A header row is optional — if the first cell in row 1 is `Name`, `Nombre`, or `Product` (case-insensitive), it is skipped automatically.

---

## 7. Local development

```bash
npm install          # install http-server (only dev dep)
npm run build        # fetch catalog from Google Sheets → update src/index.html
npm start            # serve src/ at http://localhost:3000
```

> **Node ≥ 18** required — the build script uses the built-in `fetch`.

To test the Netlify functions locally (file upload):

```bash
npm install -g netlify-cli
netlify dev          # serves site + functions at http://localhost:8888
```

You will need a `.env` file (or the Netlify CLI will read from your linked Netlify site) with the four environment variables set.

---

## 8. Changing the color palette

All colors are CSS custom properties at the top of `src/css/style.css`:

```css
:root {
  --rose-400: #E07095;   /* primary accent */
  --sage-400: #7FAF8C;   /* secondary accent */
  --cream:    #FDF6F0;   /* page background */
  --dark:     #2D1F28;   /* headings / footer */
}
```

Change those four values and the entire site recolors. No other CSS needs touching.
