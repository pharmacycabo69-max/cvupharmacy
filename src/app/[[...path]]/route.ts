import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { handleStore, HTML_PATCH } from "@/lib/store";

/**
 * Sirve la copia estática de cvupharmacy.com (carpeta mirror/, hecha con wget)
 * en las mismas URLs del sitio original.
 *
 * wget deja los enlaces como "shop/index.html" y los archivos con "?ver=..." en el
 * nombre; aquí se normalizan al vuelo para que el HTML original funcione intacto.
 */
export const dynamic = "force-dynamic";

const ROOT = path.join(process.cwd(), "mirror");
const SITE = "https://cvupharmacy.com";

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8",
  json: "application/json", txt: "text/plain; charset=utf-8", xml: "application/xml",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  svg: "image/svg+xml", ico: "image/x-icon", avif: "image/avif",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", eot: "application/vnd.ms-fontobject",
  mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf",
};

const isFile = (p: string) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

/** Resuelve una URL a un archivo del espejo: exacto, con "?query" en el nombre, o index.html. */
function resolve(segments: string[], search: string): string | null {
  const rel = path.join(...segments.map((s) => decodeURIComponent(s)));
  const abs = path.join(ROOT, rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null; // evita ../
  for (const p of [abs, search ? abs + search : "", path.join(abs, "index.html")]) {
    if (p && isFile(p)) return p;
  }
  // Pedido sin "?ver=": usa la variante guardada con query en el nombre.
  try {
    const hit = fs.readdirSync(path.dirname(abs)).find((n) => n.startsWith(path.basename(abs) + "?"));
    if (hit) return path.join(path.dirname(abs), hit);
  } catch {}
  return null;
}

const localPaths = new Map<string, boolean>();
const existsLocally = (urlPath: string) => {
  let v = localPaths.get(urlPath);
  if (v === undefined) localPaths.set(urlPath, (v = resolve(urlPath.split("/").filter(Boolean), "") !== null));
  return v;
};

// Checkout: la copia solo armaba un mensaje de WhatsApp. Con "Pay Now" ahora manda los datos de entrega al
// servidor (POST /checkout/), que los valida y abre Stripe mostrándolos; "Pay on Delivery" sigue por WhatsApp.
const WA_LINE = "var url = 'https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(msg);";
// Aviso de error dentro de la página (sobre el resumen) en lugar de un popup.
const BANNER = String.raw`(function(){var o=root.querySelector('.cvu-ck-banner');if(o)o.remove();var cards=root.querySelectorAll('.cvu-ck-card');var last=cards[cards.length-1];var d=document.createElement('div');d.className='cvu-ck-banner';d.setAttribute('role','alert');d.textContent=msg;if(last)last.parentNode.insertBefore(d,last);else root.appendChild(d);d.scrollIntoView({behavior:'smooth',block:'center'});})();`;
const PAY_NOW =
  "if(d.pmtMethod==='pay-now'){" +
  "var btn=root.querySelector('[data-place]');" +
  "if(btn){btn.disabled=true;btn.textContent='Opening secure payment…';}" +
  "fetch('/checkout/',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(d)})" +
  ".then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})" +
  ".then(function(x){if(x.ok&&x.j.url){window.location.href=x.j.url;return;}throw new Error((x.j&&x.j.error)||'');})" +
  ".catch(function(e){if(btn){btn.disabled=false;btn.innerHTML='Order Securely &rarr;';}" +
  "var msg=e&&e.message&&e.message!=='Failed to fetch'?e.message:'We could not start the card payment. Please try again or choose Pay on Delivery.';" +
  BANNER + "});" +
  "return;}";
// Validación: el mensaje va junto a cada campo (y se quita al escribir), no en un popup.
const ALERT_REQUIRED = "alert('Please complete all required fields.');";
const INLINE_ERRORS = String.raw`(function(){var M={name:'Enter your full name',phone:'Enter a valid phone number',email:'Enter a valid email address',hotelName:'Enter the hotel name',airbnbAddress:'Enter the Airbnb address',otherAddress:'Enter the delivery address'};root.querySelectorAll('.cvu-ck-msg').forEach(function(m){m.remove();});errs.forEach(function(k){var el=root.querySelector('[data-fld="'+k+'"]');if(!el)return;var box=el.closest('.cvu-ck-fld')||el.parentNode;var m=document.createElement('div');m.className='cvu-ck-msg';m.textContent=M[k]||'Required';box.appendChild(m);});if(!root.__cvuErr){root.__cvuErr=1;root.addEventListener('input',function(e){var t=e.target;if(t.classList&&t.classList.contains('cvu-ck-err')){t.classList.remove('cvu-ck-err');var b=t.closest('.cvu-ck-fld');var n=b&&b.querySelector('.cvu-ck-msg');if(n)n.remove();}});}var f=root.querySelector('.cvu-ck-err');if(f)f.focus({preventScroll:true});})();`;
// El cursor empieza en el primer campo vacío (solo con ratón/trackpad: en el móvil abriría el teclado de golpe).
const AUTOFOCUS = String.raw`try{if(window.matchMedia&&matchMedia('(pointer:fine)').matches){var order=['name','phone','email','hotelName','airbnbAddress','otherAddress'];for(var i=0;i<order.length;i++){var f0=root.querySelector('[data-fld="'+order[i]+'"]');if(f0&&!f0.value){f0.focus({preventScroll:true});break;}}}}catch(e){}`;
// Código de país por defecto según el idioma del navegador (lo guardado por el cliente tiene prioridad).
const COUNTRY_BY_LOCALE = String.raw`countryCode:(function(){var r=((navigator.language||'').split('-')[1]||'').toUpperCase();return {MX:'+52',GB:'+44',FR:'+33',DE:'+49',ES:'+34'}[r]||'+1';})(),`;
const OLD_NOTICE = "<strong>Note:</strong> Card processing is being finalized. Your order details will be confirmed by our team via WhatsApp within minutes for secure payment coordination.";
const NEW_NOTICE = "<strong>Secure card payment:</strong> after you tap Order, you pay on Stripe and your delivery details are shown there. Prefer cash? Choose Pay on Delivery and we confirm on WhatsApp.";

// La copia de /checkout/ se guardó con el carrito vacío: trae el bloque "Your cart is currently empty!" de
// WooCommerce y el pie de página por encima del formulario. Con el formulario activo se ocultan.
const CHECKOUT_CSS =
  "<style>" +
  // la copia trae el bloque de carrito vacío de WooCommerce y el pie de página sobre el formulario
  "body.cvu-ck-active main#content,body.cvu-ck-active #site-footer{display:none!important}" +
  // formulario compacto: sin franja, menos espacios, iconos y campos más pequeños
  "html body.cvu-ck-active .cvu-ck-marquee-wrap{display:none!important}" +
  "html body.cvu-ck-active #cvu-ck-root{margin-top:72px;padding-top:6px}" +
  "html body.cvu-ck-active .cvu-ck-h1{font-size:26px;margin:0 0 2px}" +
  "html body.cvu-ck-active .cvu-ck-sub{margin:0 0 6px}" +
  "html body.cvu-ck-active .cvu-ck-crumb{margin:0 0 10px}" +
  "html body.cvu-ck-active .cvu-ck-card{padding:14px 16px;margin-bottom:10px}" +
  "html body.cvu-ck-active .cvu-ck-fld{margin-bottom:10px}" +
  "html body.cvu-ck-active .cvu-ck-fld label{margin-bottom:4px}" +
  "html body.cvu-ck-active .cvu-ck-fld input,html body.cvu-ck-active .cvu-ck-fld select{padding:10px 12px}" +
  "html body.cvu-ck-active .cvu-ck-fld textarea{min-height:56px;padding:10px 12px}" +
  "html body.cvu-ck-active .cvu-ck-opt{padding:8px 6px;gap:4px}" +
  "html body.cvu-ck-active .cvu-ck-opt .cvu-ck-emo,html body.cvu-ck-active .cvu-ck-icon{width:32px;height:32px}" +
  "html body.cvu-ck-active .cvu-ck-chip{padding:7px 12px}" +
  "html body.cvu-ck-active .cvu-ck-card .cvu-ck-hint{margin-bottom:8px}" +
  "html body.cvu-ck-active .cvu-ck-notice{padding:8px 12px;margin-bottom:8px}" +
  "html body.cvu-ck-active .cvu-ck-pmt-logos{margin-top:8px;padding:8px 10px}" +
  "html body.cvu-ck-active .cvu-ck-summary{padding:12px;margin-top:8px}" +
  // errores en línea y aviso del servidor
  "html body.cvu-ck-active .cvu-ck-msg{color:#dc2626;font-size:12px;font-weight:600;margin-top:4px}" +
  "html body.cvu-ck-active .cvu-ck-banner{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:10px;grid-column:1/-1}" +
  // pantallas anchas: dos columnas (contacto+dirección, hora+instrucciones, propina+pago); el resto a todo el ancho
  "@media(min-width:720px){" +
  "html body.cvu-ck-active #cvu-ck-root{max-width:800px;display:grid!important;grid-template-columns:1fr 1fr;column-gap:12px;align-items:start}" +
  "html body.cvu-ck-active #cvu-ck-root>*{grid-column:1/-1}" +
  "html body.cvu-ck-active #cvu-ck-root>.cvu-ck-card:nth-child(n+5):nth-child(-n+10){grid-column:auto}" +
  "html body.cvu-ck-active .cvu-ck-sticky-inner{max-width:800px}" +
  "}" +
  "</style>";

// Favicon (corazón rojo, generado con scraper/make_favicon.py). La copia original no declaraba ninguno.
const ICONS =
  `<link rel="icon" href="/favicon.svg?v=1" type="image/svg+xml">` +
  `<link rel="icon" href="/favicon.ico?v=1" sizes="48x48">` +
  `<link rel="icon" href="/favicon-32x32.png?v=1" type="image/png" sizes="32x32">` +
  `<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=1">`;

function fixHtml(html: string, canonical: string): string {
  return html
    .replace(/<head([^>]*)>/i, (m) => (/rel=["'](?:shortcut )?icon["']/i.test(html) ? m : m + ICONS))
    .replace(WA_LINE, () => PAY_NOW + WA_LINE)
    .replace(OLD_NOTICE, () => NEW_NOTICE)
    .replace(ALERT_REQUIRED, () => INLINE_ERRORS)
    .replace("countryCode:'+1',", () => COUNTRY_BY_LOCALE)
    .replace(/render\(\);\s*\}\s*if\(document\.readyState==='loading'\) document\.addEventListener\('DOMContentLoaded',init\);/, (m) => m.replace("render();", () => "render();" + AUTOFOCUS))
    .replace("</head>", () => CHECKOUT_CSS + "</head>")
    // wget dejó el canonical relativo ("index.html"); debe ser la URL absoluta de la página
    .replace(/(<link rel="canonical" href=")[^"]*(")/g, `$1${canonical}$2`)
    // menú flotante de contacto: sin opción ni dirección de correo
    .replace(/<a class="cvu-hub-act cvu-act-mail" data-hub-mail>[\s\S]*?<\/a>/, "")
    .replace(/\s*email: "[^"]*@cvupharmacy\.com",\s*emailSubject: "[^"]*",/, "")
    .replace(/\s*mailEl\.addEventListener\("click", function \(\) \{ track\("email"\); \}\);/, "")
    .replace(/\s*var mailEl = modal\.querySelector\("\[data-hub-mail\]"\);/, "")
    .replace(/\s*mailEl\.href = [^;]*;/, "")
    .replace(/\s*document\.getElementById\("cvu-hub-mailsub"\)\.textContent = [^;]*;/, "")
    // rutas de assets que el JS inline arma con el dominio (Elementor, WooCommerce): que apunten al espejo
    .replace(/https:\\\/\\\/(?:www\.)?cvupharmacy\.com(\\\/wp-(?:content|includes)\\\/)/g, "$1")
    .replace(/https:\/\/(?:www\.)?cvupharmacy\.com(\/wp-(?:content|includes)\/)/g, "$1")
    // mini-carrito: wget antepuso la URL de la página a la miniatura (que ya es absoluta)
    .replace(/src="https:\/\/cvupharmacy\.com\/[^"']*\/'\+esc\(img\)/g, `src="'+esc(img)`)
    // "?ver=1" que wget codificó en los enlaces a archivos
    .replace(/(\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|ico))%3F/g, "$1?")
    // "shop/index.html" -> "shop/", "index.html" -> "./"
    .replace(/((?:href|action)=")((?:[^"#?]*\/)?)index\.html((?:[#?][^"]*)?")/g, (_m, a, dir, rest) => `${a}${dir || "./"}${rest}`)
    // enlaces absolutos al propio sitio -> locales, si la página existe en el espejo
    .replace(/(<a\b[^>]*?\shref=")https:\/\/(?:www\.)?cvupharmacy\.com(\/[^"#?]*)/g, (m, a, p) => (existsLocally(p) ? `${a}${p}` : m))
    // carrito: abre el mini-carrito tras agregar desde la página de producto y oculta el enlace "View cart"
    .replace("</body>", `${HTML_PATCH}</body>`);
}

const htmlCache = new Map<string, string>();

export async function GET(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path: segs = [] } = await params;
  const store = await handleStore(req, segs);
  if (store) return store;
  const url = new URL(req.url);
  const file = resolve(segs, url.search);
  if (!file) return new Response("Not found", { status: 404 });

  const ext = path.extname(file.split("?")[0]).slice(1).toLowerCase();
  const type = TYPES[ext] ?? "application/octet-stream";

  if (ext === "html") {
    let body = htmlCache.get(file);
    if (body === undefined) {
      const dir = path.relative(ROOT, path.dirname(file)).split(path.sep).join("/");
      body = fixHtml(fs.readFileSync(file, "utf-8"), `${SITE}/${dir ? encodeURI(dir) + "/" : ""}`);
      if (htmlCache.size > 300) htmlCache.clear();
      htmlCache.set(file, body);
    }
    return new Response(body, { headers: { "content-type": type, "cache-control": "public, max-age=300" } });
  }

  const { size } = fs.statSync(file);
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
    headers: { "content-type": type, "content-length": String(size), "cache-control": "public, max-age=86400" },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path: segs = [] } = await params;
  const store = await handleStore(req, segs);
  return store ?? new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
}

export const HEAD = GET;
