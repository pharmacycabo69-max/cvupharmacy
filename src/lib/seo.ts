import { hotelSection } from "@/lib/hotels";
import { getCatalog } from "@/lib/store";

/**
 * SEO y conversión para la réplica de cvupharmacy.com.
 *
 * Todo se aplica al vuelo sobre el HTML de mirror/ (no se tocan los archivos de la copia):
 * - consolidación de páginas duplicadas (301) y noindex de archivos sin valor (etiquetas, autores…)
 * - limpieza de documentos HTML anidados que Elementor dejó dentro del <body>
 * - títulos y descripciones de producto con intención local, schema Product/Offer y Pharmacy
 * - aviso de entrega bajo el precio y salida por WhatsApp para productos sin stock
 * - robots.txt y sitemaps coherentes con lo anterior
 */

export const SITE = "https://cvupharmacy.com";
const PHONE = "+52 624 226 1023";
const LOGO = `${SITE}/wp-content/uploads/2026/04/CVU-PARMACY.png`;
const AUTHOR = "CVU Pharmacy Team";
const HOTEL_MARK = "<!--cvu-hotel-guide-->";

/* ---------- consolidación de contenido duplicado ---------- */

// Páginas que compiten por la misma búsqueda (mismo título o misma intención) → la más completa.
// Concentrar señales en una sola URL evita la canibalización. "" = portada.
const CONSOLIDATE: Record<string, string> = {
  "best-pharmacy-delivery-cabo-san-lucas-3": "best-pharmacy-delivery-cabo-san-lucas-2",
  "pharmacy-delivery-cabo-san-lucas-4": "pharmacy-delivery-cabo-san-lucas-2",
  "pharmacy-delivery-cabo-san-lucas-5": "pharmacy-delivery-cabo-san-lucas-2",
  "cabo-san-lucas-pharmacy-delivery-2": "pharmacy-delivery-cabo-san-lucas-2",
  "cabo-san-lucas-pharmacy-delivery-4": "pharmacy-delivery-cabo-san-lucas-2",
  "medication-delivery-cabo-san-lucas-3": "medication-delivery-cabo-san-lucas-2",
  "wellness-products-delivery-cabo-san-lucas-4": "wellness-products-delivery-cabo-san-lucas-2",
  "vitamins-supplements-delivery-cabo-san-lucas-2": "vitamins-supplements-delivery-cabo-san-lucas",
  "emergency-pharmacy-services-cabo-san-lucas-2": "emergency-pharmacy-delivery-cabo-san-lucas-2",
  "first-aid-kits-cabo-san-lucas-2": "first-aid-kit-cabo-san-lucas",
  "online-doctor-appointments-cabo-san-lucas-2": "online-doctor-consultation-cabo-san-lucas-2",
  "cvu-pharmacy-top-delivery-los-cabos-full-story": "best-pharmacy-delivery-cabo-san-lucas-cvu",
  "hangover-delivery-cabo-recovery-kit": "hangover-cure-delivery-cabo-morning-after",
  "hello-world": "",
};

const REDIRECTS = new Map(Object.entries(CONSOLIDATE).map(([from, to]) => [`/${from}/`, to ? `/${to}/` : "/"]));

const normPath = (p: string) => {
  let out = p.toLowerCase().replace(/\/index\.html$/, "/");
  if (!out.endsWith("/")) out += "/";
  return out;
};

/** Destino 301 de una ruta, o null. Las páginas de autor (una publicaba un correo personal) van a la portada. */
export function redirectTarget(pathname: string): string | null {
  const p = normPath(pathname);
  if (p.startsWith("/author/")) return "/";
  return REDIRECTS.get(p) ?? null;
}

// Archivos sin contenido propio: se pueden rastrear (follow) pero no deben competir en Google.
const NOINDEX = [
  /^\/tag\//, /^\/product-tag\//, /^\/category\/uncategorized\//,
  /^\/cart\//, /^\/checkout\//, /^\/my-account\//, /^\/order-received\//,
  /^\/doctor-dashboard\//, /^\/meeting\//,
];
export const isNoindex = (pathname: string) => NOINDEX.some((r) => r.test(normPath(pathname)));

/* ---------- utilidades ---------- */

const decode = (s: string) =>
  s.replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const jsonLd = (o: object) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const fit = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1).replace(/[\s,.;:–-]+\S*$/, "") + "…");

// Nombres de producto en MAYÚSCULAS ("ASCORBIC ACID 500MG 30 CAPSULES") → "Ascorbic Acid 500mg 30 Capsules".
const UNITS = new Set(["MG", "ML", "G", "GR", "KG", "MCG", "OZ", "IU", "UI", "CM", "MM", "L", "LB", "FL"]);
const SMALL = new Set(["OF", "AND", "FOR", "WITH", "IN", "ON", "THE", "TO", "OR", "DE", "Y", "CON", "PARA", "EN", "X"]);
const ACRONYMS = new Set(["SPF", "UV", "UVA", "UVB", "PH", "DHA", "EPA", "CBD", "USB", "LED", "XL", "XXL", "XS", "II", "III", "IV", "HD", "PM", "AM", "C", "E", "A", "B", "D", "K"]);
function fixWord(w: string, first: boolean): string {
  if (!/[A-Za-zÀ-ÿ]/.test(w)) return w;
  const up = w.toUpperCase();
  if (/\d/.test(w)) return /^(B\d{1,2}|D\d|K\d|Q10|MK\d)$/.test(up) ? up : w.toLowerCase(); // B12, D3 / 500mg, 20x
  if (ACRONYMS.has(up)) return up;
  if (UNITS.has(up)) return w.toLowerCase();
  if (!first && SMALL.has(up)) return w.toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}
export function smartTitle(name: string): string {
  const s = name.trim().replace(/\s+/g, " ");
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "").length;
  if (!letters || upper / letters.length < 0.8) return s;
  return s.split(" ").map((tok, i) => tok.split(/([-\/(),+])/).map((part, j) => fixWord(part, i === 0 && j === 0)).join("")).join(" ");
}

// recorta en el último espacio, sin "…" (para títulos)
const cut = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max).replace(/[\s,.;:–\-/(]+\S*$/, ""));

/** Cambia el contenido de una meta; si no existe, la crea tras el <title>. */
function setMeta(html: string, key: string, value: string): string {
  const re = new RegExp(`(<meta (?:name|property)="${key}" content=")[^"]*(")`);
  if (re.test(html)) return html.replace(re, (_m, a, b) => a + attr(value) + b);
  const kind = key.startsWith("og:") ? "property" : "name";
  return html.replace(/<\/title>/, (m) => `${m}\n<meta ${kind}="${key}" content="${attr(value)}" />`);
}

/* ---------- limpieza del documento (antes de fixHtml) ---------- */

/** Fin (índice tras el </div>) del elemento <div> que empieza en `start`; ignora el contenido de <script>/<style>. */
function closeOf(s: string, start: number): number {
  const tag = /<(\/?)(div|script|style)\b[^>]*>/gi;
  tag.lastIndex = start;
  let depth = 0;
  for (let m = tag.exec(s); m; m = tag.exec(s)) {
    const name = m[2].toLowerCase();
    if (name !== "div") {
      if (!m[1]) {
        const close = s.toLowerCase().indexOf(`</${name}>`, tag.lastIndex);
        if (close < 0) return -1;
        tag.lastIndex = close + name.length + 3;
      }
      continue;
    }
    depth += m[1] ? -1 : 1;
    if (depth === 0) return tag.lastIndex;
  }
  return -1;
}

/**
 * - Quita los bloques de Elementor ocultos en escritorio, tablet y móvil (nunca se ven; en la portada era un
 *   documento HTML completo de ~150 KB con su propio <title>, canonical y fuente de Google que bloqueaba el render).
 * - Quita <title>, metas SEO y canonical que widgets HTML dejaron dentro del <body> (Google los toma como ruido).
 * - Deja una sola meta description (las fichas de producto traían dos).
 * - Une las 4 hojas de Google Fonts de Elementor en una sola petición (mismas fuentes y pesos).
 */
export function cleanDocument(html: string): string {
  const bodyAt = html.search(/<body[\s>]/i);
  if (bodyAt < 0) return html;
  let head = html.slice(0, bodyAt);
  let body = html.slice(bodyAt);

  const hidden = /<div\b[^>]*class="[^"]*elementor-hidden-desktop elementor-hidden-tablet elementor-hidden-mobile[^"]*"[^>]*>/g;
  let out = "", last = 0;
  for (let m = hidden.exec(body); m; m = hidden.exec(body)) {
    const end = closeOf(body, m.index);
    if (end < 0 || end - m.index > body.length * 0.6) continue;
    out += body.slice(last, m.index);
    last = end;
    hidden.lastIndex = end;
  }
  body = out + body.slice(last);

  body = body
    // cierre del documento anidado de las páginas de hotel: marca para insertar la guía ampliada y evita que
    // fixHtml tome este </body> como el final real de la página
    .replace("<p></body></html></p>", HOTEL_MARK)
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\s+(?:name|property)=["'](?:description|keywords|viewport|robots|author|og:[^"']*|twitter:[^"']*)["'][^>]*>/gi, "")
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");

  let seen = false;
  head = head.replace(/<meta name="description"[^>]*>\s*/g, (m) => (seen ? "" : ((seen = true), m)));

  const gf = /<link rel='stylesheet' id='elementor-gf-[\w-]+-css' href='https:\/\/fonts\.googleapis\.com\/css\?family=([^:']+):[^']*' media='all' \/>\s*/g;
  const families = [...head.matchAll(gf)].map((m) => m[1]);
  if (families.length > 1) {
    const axis = "ital,wght@" + [0, 1].flatMap((i) => [100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => `${i},${w}`)).join(";");
    const href = "https://fonts.googleapis.com/css2?" + families.map((f) => `family=${f}:${axis}`).join("&amp;") + "&amp;display=swap";
    let first = true;
    head = head.replace(gf, () =>
      first
        ? ((first = false),
          `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
            `<link rel="stylesheet" id="cvu-fonts-css" href="${href}" media="all" />\n`)
        : "",
    );
  }
  return head + body;
}

/* ---------- SEO por página (después de fixHtml) ---------- */

const pharmacySchema = () => ({
  "@context": "https://schema.org",
  "@type": "Pharmacy",
  "@id": `${SITE}/#pharmacy`,
  name: "CVU Pharmacy",
  alternateName: "CVU Concierge Pharmacy",
  description: "English-speaking pharmacy in Cabo San Lucas with 24/7 delivery of OTC medications, vitamins and wellness essentials to hotels, villas and yachts in Los Cabos.",
  url: `${SITE}/`,
  logo: LOGO,
  image: LOGO,
  telephone: PHONE,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Blvd. Paseo de la Marina 869, Plaza Gali, Local 048",
    addressLocality: "Cabo San Lucas",
    addressRegion: "Baja California Sur",
    postalCode: "23450",
    addressCountry: "MX",
  },
  hasMap: "https://maps.google.com/?q=PLAZA+GALI+Blvd+Paseo+de+la+Marina+869+Cabo+San+Lucas",
  openingHoursSpecification: [{
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    opens: "08:00",
    closes: "18:00",
  }],
  areaServed: ["Cabo San Lucas", "San José del Cabo", "Los Cabos", "Tourist Corridor"].map((name) => ({ "@type": "Place", name })),
  knowsLanguage: ["en", "es"],
  paymentAccepted: "Cash, Credit Card",
  currenciesAccepted: "USD, MXN",
  parentOrganization: { "@id": `${SITE}/#organization` },
  contactPoint: { "@type": "ContactPoint", telephone: PHONE, contactType: "customer service", availableLanguage: ["English", "Spanish"], hoursAvailable: "Mo-Su 00:00-23:59" },
});

const CONVERSION_CSS =
  "<style id=\"cvu-seo-css\">" +
  ".cvu-oos{margin:8px 0 16px;padding:14px 16px;border:1px solid #f0d9a8;background:#fffaf0;border-radius:12px;color:#3b2f14}" +
  ".cvu-oos p{margin:0;font-size:14px;line-height:1.5}.cvu-oos .cvu-oos-t{font-weight:700;font-size:15px;margin-bottom:4px}" +
  "</style>";

function productSeo(html: string, path: string): string {
  const id = /<body[^>]*\bclass="[^"]*\bpostid-(\d+)/.exec(html)?.[1];
  const h1 = /<h1 class="product_title entry-title">([\s\S]*?)<\/h1>/.exec(html)?.[1];
  const item = id ? getCatalog()[id] : undefined;
  const raw = item?.n ?? (h1 ? decode(h1.replace(/<[^>]+>/g, "")) : "");
  if (!raw) return html;
  const name = smartTitle(decode(raw));
  const url = SITE + path;

  let title: string, desc: string;
  if (item) {
    const price = (item.p / 100).toFixed(2);
    title = `${name} | Delivery in Cabo San Lucas`;
    if (title.length > 65) title = `${cut(name, 48)} | Cabo Delivery`;
    desc = `${fit(name, 70)} – $${price} USD, delivered to your hotel, villa or yacht in Cabo San Lucas, usually in under 60 minutes. English-speaking pharmacy, delivery 24/7.`;
    // WooCommerce ya publica Product + Offer (precio, stock, vendedor); solo se corrige el nombre en MAYÚSCULAS
    html = html.replace(
      new RegExp(`("@type":"Product","@id":"${url.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}#product","name":)"[^"]*"`),
      (_m, a) => a + JSON.stringify(name).replace(/</g, "\\u003c"),
    );
  } else {
    // sin precio: la ficha quedaba sin precio ni botón de compra; se explica y se dirige al botón de WhatsApp
    title = `${cut(name, 42)} in Cabo San Lucas | CVU Pharmacy`;
    desc = `Looking for ${fit(name, 70)} in Cabo San Lucas? Message our English-speaking pharmacy on WhatsApp for availability and price, delivered to your hotel or villa.`;
    const box =
      `<div class="cvu-oos"><p class="cvu-oos-t">Not available to order online right now</p>` +
      `<p>Tap <strong>Order on WhatsApp</strong> and our English-speaking pharmacy will confirm availability and price, ` +
      `or suggest an equivalent, delivered to your hotel, villa or yacht in Cabo.</p></div>`;
    html = html.replace('<p class="price"></p>', () => box);
  }

  // descripciones plantilla: hablaban de "envíos"; el negocio es entrega local
  html = html
    .replace(/shipped fast and handled with care/g, "delivered to your hotel, villa or yacht in Cabo")
    .replace(/ship every order carefully packed/g, "deliver every order to your hotel, villa or yacht in Los Cabos")
    .replace(/fast shipping and secure checkout/g, "same-day delivery in Cabo San Lucas");

  html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${attr(title)}</title>`);
  for (const k of ["description", "og:description", "twitter:description"]) html = setMeta(html, k, desc);
  for (const k of ["og:title", "twitter:title"]) html = setMeta(html, k, title);
  return html.replace("</head>", () => CONVERSION_CSS + "</head>");
}

/** Aplica el SEO a una página ya corregida por fixHtml. `path` es la ruta pública con barra final. */
export function applySeo(html: string, path: string): string {
  // autor: un post publicaba un correo personal como autor; otro, un usuario genérico de WordPress
  html = html
    .replace(/ramigool20@gmail\.com/g, AUTHOR)
    .replace(/cabo command admin/gi, AUTHOR)
    .replace(/"name":"Pharmacy Delivery Services"/g, '"name":"CVU Pharmacy"')
    .replace(/(<a\b[^>]*\shref=")[^"]*\/author\/[^"]*(")/g, "$1/$2");

  // afirmaciones que no se pueden demostrar ("#1", calificaciones sin reseñas detrás) → diferenciadores reales.
  // Las calificaciones propias en schema (aggregateRating) van contra las reglas de Google.
  html = html
    .replace(/is the #1 English-speaking pharmacy delivery in Cabo San Lucas/g, "is Cabo San Lucas' 24/7 English-speaking pharmacy delivery")
    .replace(/<span>4\.9 &middot; Rated by 5,000\+ travelers<\/span>/g, "<span>English-speaking pharmacy &middot; 24/7 delivery</span>")
    .replace(/⭐ 4\.9 rated by U\.S\. &amp; Canadian travelers/g, "🗣️ English-speaking team for U.S. &amp; Canadian travelers")
    .replace(/(<div class="cvu-consult-stars">)(?:&#9733;)+<span>4\.9 &middot; 87 Reviews<\/span>/g, "$1<span>Licensed physician &middot; English &amp; Spanish</span>")
    .replace(/<span class="st">★<\/span> 4\.9 · traveler rating/g, "Hotel &amp; villa visits")
    .replace(/<strong>★ 4\.9<\/strong> · Trusted by hundreds of guests at/g, "<strong>24/7 delivery</strong> · Serving guests at")
    .replace(/,?"aggregateRating":\{"@type":"AggregateRating"[^}]*\}/g, "");
  if (path.startsWith("/product/")) {
    html = html.replace("</head>", () => "<style>.cvu-pp-rating svg{display:none}</style></head>");
  }

  // enlaces a un sitio ajeno (pharmacyincabo.com) en las listas "Related": se quita el elemento; si no, el enlace
  html = html
    .replace(/<li><a\b[^>]*href="https?:\/\/(?:www\.)?pharmacyincabo\.com[^"]*"[^>]*>[\s\S]*?<\/a><\/li>\s*/g, "")
    .replace(/<a\b[^>]*href="https?:\/\/(?:www\.)?pharmacyincabo\.com[^"]*"[^>]*>([\s\S]*?)<\/a>/g, "$1");

  // enlaces internos a páginas consolidadas → destino final (sin saltos de redirección)
  html = html.replace(
    /(\shref=")(?:https?:\/\/(?:www\.)?cvupharmacy\.com)?(?:\.\.?\/)*\/?([a-z0-9-]+)\/(?:index\.html)?(#[^"]*)?"/g,
    (m, a, slug, hash = "") => {
      const to = REDIRECTS.get(`/${slug}/`);
      return to ? `${a}${to}${hash}"` : m;
    },
  );

  if (isNoindex(path)) {
    html = html.replace(/<meta name='robots' content='[^']*'/, "<meta name='robots' content='noindex, follow'");
  }

  // títulos de posts y páginas: el sufijo " — CVU Pharmacy Cabo San Lucas" los dejaba en 70-110 caracteres
  html = html.replace(/<title>([\s\S]*?) &#8212; CVU Pharmacy Cabo San Lucas<\/title>/, (_m, base: string) => {
    const short = decode(base).length + 15 <= 62 ? `${base} | CVU Pharmacy` : base;
    return `<title>${short}</title>`;
  });

  // páginas de hotel: guía ampliada debajo del encabezado (el original terminaba ahí)
  const hotel = hotelSection(path);
  if (hotel && html.includes(HOTEL_MARK)) {
    html = html
      .replace(HOTEL_MARK, () => hotel.html)
      .replace("</head>", () => jsonLd(hotel.faq) + "</head>");
  }

  if (path === "/") html = html.replace("</head>", () => jsonLd(pharmacySchema()) + "</head>");
  if (path.startsWith("/product/")) html = productSeo(html, path);
  return html;
}

/* ---------- robots.txt y sitemaps ---------- */

export const ROBOTS_TXT = `User-agent: *
Disallow: /cart/
Disallow: /checkout/
Disallow: /my-account/
Disallow: /order-received/
Disallow: /wp-admin/
Disallow: /wp-json/
Disallow: /*?s=
Disallow: /*?*add-to-cart=
Disallow: /*?*wc-ajax=
Disallow: /*?*orderby=
Disallow: /*?*filter_
Allow: /wp-content/
Allow: /wp-includes/

Sitemap: ${SITE}/sitemap_index.xml
`;

/** Quita de los sitemaps lo redirigido y lo noindex (y del índice, los sitemaps de etiquetas y autores). */
export function filterSitemap(xml: string): string {
  if (xml.includes("<sitemapindex")) {
    return xml.replace(/\s*<sitemap>\s*<loc>[^<]*sitemap-(?:authors|post-tags|product-tags)\.xml<\/loc>[\s\S]*?<\/sitemap>/g, "");
  }
  return xml.replace(/\s*<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/g, (m, loc: string) => {
    let p: string;
    try { p = new URL(loc).pathname; } catch { return m; }
    return redirectTarget(p) || isNoindex(p) ? "" : m;
  });
}
