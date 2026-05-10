const SETTINGS = {
  // ── Store ─────────────────────────────────────────────────────────────────
  storeName: "Flower St",
  storeEmail: "contacto@flowerst.com",
  storeTagline: "Impresiones con estilo, hechas para vos.",

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  // Include country code, no spaces or dashes. e.g. "+541112345678"
  whatsappPhone: "+541112345678",
  whatsappGreeting: "Hola! Me gustaría hacer un pedido desde su sitio web.",

  // ── Google Sheets catalog ─────────────────────────────────────────────────
  // The spreadsheet must be publicly accessible ("Anyone with the link can view")
  // or published via File → Share → Publish to the web.
  spreadsheetId: "1dVZQ9njepNWxefuMsPj8OvrsFuDiq5ea8rxg-TP71F0",

  // ── Google Drive upload ───────────────────────────────────────────────────
  // Folder where client files will be uploaded.
  uploadFolderId: "1-VcN-RfnFKbAgGn7CnPR3miqHpChGY-o",

  // Google Cloud OAuth 2.0 Client ID for the Drive upload feature.
  // Create at: console.cloud.google.com → APIs & Services → Credentials
  // Enable: Google Drive API
  // Authorized JS origins: add your domain (and http://localhost for local dev)
  googleClientId: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",

  // ── Hero Carousel ─────────────────────────────────────────────────────────
  // Each slide: { image, title, subtitle }
  // Leave image empty ("") to use the CSS gradient fallback.
  carouselSlides: [
    {
      image: "",
      title: "Bienvenidos a Flower St",
      subtitle: "Diseños únicos, impresiones de calidad",
    },
    {
      image: "",
      title: "Tu diseño, nuestro papel",
      subtitle: "Explorá nuestro catálogo completo",
    },
    {
      image: "",
      title: "Subí tu archivo y listo",
      subtitle: "Nosotros nos encargamos del resto",
    },
  ],

  // ── Info / Phrases section ────────────────────────────────────────────────
  infoBlocks: [
    {
      icon: "🌸",
      title: "Calidad garantizada",
      text: "Cada producto pasa por un riguroso control antes de salir de nuestras manos.",
    },
    {
      icon: "🚀",
      title: "Entrega rápida",
      text: "Producimos y enviamos en tiempo récord para que nunca esperes de más.",
    },
    {
      icon: "💬",
      title: "Atención personalizada",
      text: "Hablá con nosotros por WhatsApp y te asesoramos en cada paso.",
    },
  ],

  // ── About section ─────────────────────────────────────────────────────────
  aboutTitle: "Quiénes somos",
  aboutText:
    "Flower St nació de la pasión por el diseño y la impresión de calidad. " +
    "Somos una imprenta boutique que trabaja codo a codo con cada cliente para " +
    "transformar sus ideas en productos tangibles y memorables. " +
    "Desde tarjetas y flyers hasta packaging personalizado, " +
    "cada trabajo es único y lleva nuestra firma.",
  aboutImage: "", // optional path to an about image
};
