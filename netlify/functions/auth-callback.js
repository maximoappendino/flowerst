// auth-callback.js — Netlify Function
//
// Handles the OAuth 2.0 redirect from Google after the shopowner authorizes
// the app. Exchanges the one-time authorization code for a refresh token and
// displays it on screen so it can be stored in Netlify env vars.
//
// This function is only used once during initial setup.
// After GOOGLE_REFRESH_TOKEN is saved in Netlify, neither this function
// nor the "Conectar Google Drive" button in index.html are needed.
//
// Required Netlify environment variables (set these before clicking the button):
//   GOOGLE_CLIENT_ID      — OAuth 2.0 client ID
//   GOOGLE_CLIENT_SECRET  — OAuth 2.0 client secret
//
// The redirect URI registered in Google Cloud Console must be:
//   https://YOUR-SITE.netlify.app/.netlify/functions/auth-callback

exports.handler = async (event) => {
  const { code, error, error_description } = event.queryStringParameters || {};

  // Google returned an error (e.g. the shopowner denied access)
  if (error) {
    return page(`
      <h2>Error de autorización</h2>
      <p><strong>${escape(error)}</strong>: ${escape(error_description || "")}</p>
      <p><a href="/">Volver al sitio</a></p>
    `);
  }

  if (!code) {
    return page(`
      <p>No se recibió el código de autorización.</p>
      <p><a href="/">Volver al sitio</a></p>
    `);
  }

  // Validate that the credentials exist before trying to exchange the code
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return page(`
      <h2>⚠️ Credenciales faltantes</h2>
      <p>
        <code>GOOGLE_CLIENT_ID</code> y <code>GOOGLE_CLIENT_SECRET</code>
        deben estar configurados en Netlify antes de usar este botón.
      </p>
    `);
  }

  // Reconstruct the exact redirect URI that was used to start the flow.
  // It must match what's registered in Google Cloud Console.
  const proto = event.headers["x-forwarded-proto"] || "https";
  const host  = event.headers["host"] || "";
  const redirectUri = `${proto}://${host}/.netlify/functions/auth-callback`;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });

    const tokens = await res.json();

    if (tokens.error) {
      return page(`
        <h2>Error al obtener el token</h2>
        <p><strong>${escape(tokens.error)}</strong>: ${escape(tokens.error_description || "")}</p>
        <p>Intentá autorizar de nuevo desde el sitio.</p>
      `);
    }

    // refresh_token is only returned on the first authorization.
    // If it's absent, the shopowner needs to revoke access in her Google account
    // and authorize again so Google sends a fresh one.
    const refreshToken =
      tokens.refresh_token ||
      "(vacío — revocá el acceso en myaccount.google.com/permissions y autorizá de nuevo)";

    return page(`
      <h2>✅ Autorización exitosa</h2>
      <p>
        Copiá el <strong>Refresh Token</strong> de abajo y guardalo en Netlify como
        <code>GOOGLE_REFRESH_TOKEN</code>:
      </p>
      <textarea rows="4" style="width:100%;font-family:monospace;font-size:14px;padding:8px"
                readonly onclick="this.select()">${escape(refreshToken)}</textarea>

      <h3 style="margin-top:2rem">Pasos para terminar la configuración</h3>
      <ol>
        <li>Copiá el token de arriba.</li>
        <li>Netlify → <em>Site configuration → Environment variables</em> → agregá
            <code>GOOGLE_REFRESH_TOKEN</code> con ese valor.</li>
        <li>Hacé <em>Deploys → Trigger deploy</em> para que el sitio tome el nuevo valor.</li>
        <li>Avisale al desarrollador para que elimine el botón "Conectar Google Drive"
            del HTML.</li>
      </ol>

      <p style="margin-top:1.5rem"><a href="/">Volver al sitio</a></p>
    `);
  } catch (err) {
    return page(`
      <h2>Error inesperado</h2>
      <p>${escape(err.message)}</p>
    `);
  }
};

// Wrap HTML content in a minimal styled page.
function page(content) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flower St — Autorización de Google Drive</title>
  <style>
    body { font-family: sans-serif; max-width: 640px; margin: 3rem auto; padding: 1rem; color: #2d1f28; }
    code { background: #f5f0f3; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
    textarea { background: #f5f0f3; border: 1px solid #ccc; border-radius: 4px; }
    a { color: #e07095; }
    h2 { color: #2d1f28; }
  </style>
</head>
<body>${content}</body>
</html>`,
  };
}

// Minimal HTML escaping to prevent reflection of OAuth error strings.
function escape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
