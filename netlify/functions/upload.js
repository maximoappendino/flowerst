// upload.js — Netlify Function
//
// Receives a single file from the customer's browser and uploads it to
// the shopowner's Google Drive folder using server-stored credentials.
// Customers never need a Google account.
//
// Request
//   POST /.netlify/functions/upload
//   Headers:
//     Content-Type   — MIME type of the file (e.g. "image/jpeg")
//     X-File-Name    — URL-encoded filename (e.g. "mi%20foto.jpg")
//     X-Folder-Id    — URL-encoded Drive folder ID (falls back to UPLOAD_FOLDER_ID env var)
//   Body: raw file bytes
//
// Required Netlify environment variables:
//   GOOGLE_CLIENT_ID      — OAuth 2.0 client ID from Google Cloud Console
//   GOOGLE_CLIENT_SECRET  — OAuth 2.0 client secret
//   GOOGLE_REFRESH_TOKEN  — long-lived refresh token obtained via auth-callback
//   UPLOAD_FOLDER_ID      — (optional) Google Drive folder ID fallback

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  // Validate that all required credentials are present before touching anything
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    return jsonResponse(500, {
      error:
        "Google credentials not configured. " +
        "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN in Netlify.",
    });
  }

  try {
    // Step 1: get a fresh short-lived access token using the stored refresh token
    const accessToken = await refreshAccessToken(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REFRESH_TOKEN
    );

    // Step 2: read the file from the request body
    const fileBuffer = Buffer.from(
      event.body,
      event.isBase64Encoded ? "base64" : "utf8"
    );
    const fileName = event.headers["x-file-name"]
      ? decodeURIComponent(event.headers["x-file-name"])
      : "archivo";
    const contentType =
      event.headers["content-type"] || "application/octet-stream";

    // Prefer the folder ID sent by the browser; fall back to the env var
    const folderId =
      (event.headers["x-folder-id"]
        ? decodeURIComponent(event.headers["x-folder-id"])
        : "") || process.env.UPLOAD_FOLDER_ID || "";

    // Step 3: upload to Google Drive
    const driveFile = await uploadToDrive({
      accessToken,
      fileBuffer,
      fileName,
      contentType,
      folderId,
    });

    return jsonResponse(200, { ok: true, id: driveFile.id, name: driveFile.name });
  } catch (err) {
    console.error("[upload]", err.message);
    return jsonResponse(500, { error: err.message });
  }
};

// Exchange the stored refresh token for a short-lived access token.
async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(
      `Token refresh failed: ${data.error_description || data.error || "unknown"}`
    );
  }
  return data.access_token;
}

// Upload one file to Google Drive using the multipart upload format.
// No npm packages needed — we build the multipart body with Buffer.concat.
// https://developers.google.com/drive/api/guides/manage-uploads#multipart
async function uploadToDrive({ accessToken, fileBuffer, fileName, contentType, folderId }) {
  const metadata = JSON.stringify({
    name: fileName,
    // Only include parents when a folder ID is actually set
    ...(folderId && { parents: [folderId] }),
  });

  const boundary = `----FlowerStUpload${Date.now()}`;

  // Build the two-part body:  [JSON metadata part] + [file binary part]
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    ),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Drive API returned ${res.status}`);
  }
  return data;
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
