import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

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

function fixHtml(html: string): string {
  return html
    // rutas de assets que el JS inline arma con el dominio (Elementor, WooCommerce): que apunten al espejo
    .replace(/https:\\\/\\\/(?:www\.)?cvupharmacy\.com(\\\/wp-(?:content|includes)\\\/)/g, "$1")
    .replace(/https:\/\/(?:www\.)?cvupharmacy\.com(\/wp-(?:content|includes)\/)/g, "$1")
    // "?ver=1" que wget codificó en los enlaces a archivos
    .replace(/(\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|ico))%3F/g, "$1?")
    // "shop/index.html" -> "shop/", "index.html" -> "./"
    .replace(/((?:href|action)=")((?:[^"#?]*\/)?)index\.html((?:[#?][^"]*)?")/g, (_m, a, dir, rest) => `${a}${dir || "./"}${rest}`)
    // enlaces absolutos al propio sitio -> locales, si la página existe en el espejo
    .replace(/(<a\b[^>]*?\shref=")https:\/\/(?:www\.)?cvupharmacy\.com(\/[^"#?]*)/g, (m, a, p) => (existsLocally(p) ? `${a}${p}` : m));
}

const htmlCache = new Map<string, string>();

export async function GET(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path: segs = [] } = await params;
  const url = new URL(req.url);
  const file = resolve(segs, url.search);
  if (!file) return new Response("Not found", { status: 404 });

  const ext = path.extname(file.split("?")[0]).slice(1).toLowerCase();
  const type = TYPES[ext] ?? "application/octet-stream";

  if (ext === "html") {
    let body = htmlCache.get(file);
    if (body === undefined) {
      body = fixHtml(fs.readFileSync(file, "utf-8"));
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

export const HEAD = GET;
