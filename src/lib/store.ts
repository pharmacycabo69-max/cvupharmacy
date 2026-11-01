import fs from "node:fs";
import path from "node:path";

/**
 * Carrito + checkout dinámico para la réplica de cvupharmacy.com.
 *
 * No hay productos registrados en Stripe: el precio, el nombre y la foto salen de data/catalog.json
 * (en el servidor) y el checkout se arma al vuelo con `price_data`. El navegador solo envía ids y
 * cantidades, nunca precios.
 *
 * Implementa los endpoints de WooCommerce que ya espera la interfaz del sitio (mini-carrito,
 * botones "Add to cart", contador flotante), con el carrito guardado en una cookie.
 */

const SITE_ENV = process.env.SITE_URL || ""; // optional override; otherwise the request origin is used
const originOf = (req: Request) => SITE_ENV || new URL(req.url).origin;
const WHATSAPP = "https://wa.me/5216242261023?text=" + encodeURIComponent("Hi CVU Pharmacy! I would like to place an order.");
const COOKIE = "cvu_cart";
const MAX_LINES = 40;
const MAX_QTY = 20;

export type CatalogItem = { n: string; p: number; s: string; i: string; t: string };
export type CartLines = [string, number][];

let catalog: Record<string, CatalogItem> | null = null;
export function getCatalog(): Record<string, CatalogItem> {
  if (!catalog) catalog = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "catalog.json"), "utf-8"));
  return catalog!;
}

/* ---------- cookie ---------- */

export function readCart(req: Request): CartLines {
  const raw = /(?:^|;\s*)cvu_cart=([^;]*)/.exec(req.headers.get("cookie") || "")?.[1] || "";
  if (!/^\d+:\d+(,\d+:\d+)*$/.test(raw)) return [];
  const cat = getCatalog();
  const lines: CartLines = [];
  for (const part of raw.split(",").slice(0, MAX_LINES)) {
    const [id, q] = part.split(":");
    const qty = Math.min(MAX_QTY, parseInt(q, 10));
    if (cat[id] && qty > 0) lines.push([id, qty]);
  }
  return lines;
}

function cookieHeader(req: Request, lines: CartLines): string {
  const secure = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const value = lines.map(([id, q]) => `${id}:${q}`).join(",");
  return `${COOKIE}=${value}; Path=/; Max-Age=${lines.length ? 60 * 60 * 24 * 30 : 0}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function setQty(lines: CartLines, id: string, qty: number): CartLines {
  const cat = getCatalog();
  if (!cat[id]) return lines;
  const q = Math.min(MAX_QTY, Math.max(0, Math.floor(qty)));
  const rest = lines.filter(([i]) => i !== id);
  if (q === 0) return rest;
  if (rest.length >= MAX_LINES && !lines.some(([i]) => i === id)) return lines;
  const existing = lines.findIndex(([i]) => i === id);
  if (existing >= 0) {
    const out = lines.slice();
    out[existing] = [id, q];
    return out;
  }
  return [...rest, [id, q]];
}

const qtyOf = (lines: CartLines, id: string) => lines.find(([i]) => i === id)?.[1] ?? 0;

/* ---------- WooCommerce-compatible payloads ---------- */

const money = () => ({ currency_code: "USD", currency_symbol: "$", currency_minor_unit: 2, currency_decimal_separator: ".", currency_thousand_separator: ",", currency_prefix: "$", currency_suffix: "" });

export function cartJson(lines: CartLines) {
  const cat = getCatalog();
  let total = 0, count = 0;
  const items = lines.map(([id, q]) => {
    const it = cat[id];
    const line = it.p * q;
    total += line;
    count += q;
    return {
      key: id, id: Number(id), quantity: q, name: it.n, sku: it.s, permalink: "",
      images: [{ id: 0, src: it.i, thumbnail: it.t, name: "", alt: "" }],
      prices: { price: String(it.p), regular_price: String(it.p), sale_price: String(it.p), ...money() },
      totals: { line_subtotal: String(line), line_subtotal_tax: "0", line_total: String(line), line_total_tax: "0", ...money() },
    };
  });
  return {
    items, items_count: count, items_weight: 0, needs_payment: true, needs_shipping: true,
    totals: { total_items: String(total), total_items_tax: "0", total_price: String(total), total_tax: "0", ...money() },
  };
}

const fragments = (lines: CartLines) => {
  const n = lines.reduce((s, [, q]) => s + q, 0);
  return {
    fragments: { "span.cvu-cart-fab-badge": `<span class="cvu-cart-fab-badge" data-count="${n}" aria-hidden="true">${n}</span>` },
    cart_hash: lines.map(([id, q]) => `${id}x${q}`).join("-"),
  };
};

function json(req: Request, body: unknown, lines: CartLines | null, status = 200): Response {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  if (lines) headers.append("set-cookie", cookieHeader(req, lines));
  return new Response(JSON.stringify(body), { status, headers });
}

/* ---------- checkout ---------- */

/** Pure: turns cart lines into Stripe Checkout Session parameters (dynamic price_data, no Stripe products). */
export function buildCheckoutParams(lines: CartLines, origin: string): URLSearchParams {
  const cat = getCatalog();
  const p = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/order-received/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/shop/`,
    "phone_number_collection[enabled]": "true",
    "shipping_address_collection[allowed_countries][0]": "MX",
    "metadata[source]": "cvupharmacy.com",
  });
  const summary: string[] = [];
  let units = 0;
  lines.forEach(([id, q], n) => {
    const it = cat[id];
    const pre = `line_items[${n}]`;
    p.set(`${pre}[quantity]`, String(q));
    p.set(`${pre}[price_data][currency]`, "usd");
    p.set(`${pre}[price_data][unit_amount]`, String(it.p));
    p.set(`${pre}[price_data][product_data][name]`, it.n.slice(0, 250));
    if (it.i.startsWith("https://")) p.set(`${pre}[price_data][product_data][images][0]`, it.i);
    p.set(`${pre}[price_data][product_data][metadata][product_id]`, id);
    if (it.s) p.set(`${pre}[price_data][product_data][metadata][sku]`, it.s);
    summary.push(`${id}x${q}`);
    units += q;
  });
  p.set("metadata[items]", summary.join(" ").slice(0, 480));
  p.set("payment_intent_data[description]", `CVU Pharmacy order (${units} item${units === 1 ? "" : "s"})`);
  return p;
}

const go = (to: string, status: number) => new Response(null, { status, headers: { location: to, "cache-control": "no-store" } });

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg?v=1" type="image/svg+xml"><title>${title}</title>` +
      `<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f6f8fb;color:#0f2540}main{max-width:460px;margin:24px;padding:32px;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(15,37,64,.08);text-align:center}a.b{display:inline-block;margin-top:18px;padding:13px 24px;border-radius:999px;background:#16a34a;color:#fff;text-decoration:none;font-weight:700}p{line-height:1.6}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

async function checkout(req: Request): Promise<Response> {
  const lines = readCart(req);
  if (!lines.length) return go("/shop/", 303);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set");
    return page("Checkout unavailable", `<h1>Online checkout is not available yet</h1><p>Your cart is saved. Place your order on WhatsApp and we will confirm it right away.</p><a class="b" href="${WHATSAPP}">Order on WhatsApp</a>`, 503);
  }
  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: buildCheckoutParams(lines, originOf(req)),
    });
    const data = (await r.json()) as { url?: string; error?: unknown };
    if (!r.ok || !data.url) {
      console.error("Stripe error", r.status, data.error);
      return page("Checkout unavailable", `<h1>We couldn't start the payment</h1><p>Please try again, or place your order on WhatsApp.</p><a class="b" href="${WHATSAPP}">Order on WhatsApp</a>`, 502);
    }
    return go(data.url, 303);
  } catch (err) {
    console.error("Checkout failed", err);
    return page("Checkout unavailable", `<h1>We couldn't start the payment</h1><p>Please try again, or place your order on WhatsApp.</p><a class="b" href="${WHATSAPP}">Order on WhatsApp</a>`, 502);
  }
}

/* ---------- request router (returns null when the request is not store-related) ---------- */

async function readFields(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") || "";
  try {
    if (type.includes("application/json")) {
      const o = (await req.json()) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)]));
    }
    const fd = await req.formData();
    const out: Record<string, string> = {};
    fd.forEach((v, k) => { if (typeof v === "string") out[k] = v; });
    return out;
  } catch {
    return {};
  }
}

export async function handleStore(req: Request, segs: string[]): Promise<Response | null> {
  const url = new URL(req.url);
  const pathname = "/" + segs.join("/");
  const method = req.method;
  const ajax = url.searchParams.get("wc-ajax");

  // WooCommerce admin-ajax style endpoints used by add-to-cart.js and the floating cart badge
  if (ajax) {
    const lines = readCart(req);
    if (ajax === "get_refreshed_fragments") return json(req, fragments(lines), null);
    if (ajax === "add_to_cart" && method === "POST") {
      const f = await readFields(req);
      const id = String(f.product_id || f["add-to-cart"] || "");
      if (!getCatalog()[id]) return json(req, { error: true, product_url: "/shop/" }, null);
      const next = setQty(lines, id, qtyOf(lines, id) + Math.max(1, parseInt(f.quantity || "1", 10) || 1));
      return json(req, fragments(next), next);
    }
    return json(req, {}, null);
  }

  // WooCommerce Store API used by the mini-cart
  if (pathname.startsWith("/wp-json/wc/store/v1/cart")) {
    const sub = pathname.slice("/wp-json/wc/store/v1/cart".length).replace(/\/$/, "");
    const lines = readCart(req);
    if (method === "GET" && sub === "") return json(req, cartJson(lines), null);
    if (method === "POST") {
      const f = await readFields(req);
      if (sub === "/update-item") {
        const next = setQty(lines, String(f.key), parseInt(f.quantity || "0", 10) || 0);
        return json(req, cartJson(next), next);
      }
      if (sub === "/remove-item") {
        const next = setQty(lines, String(f.key), 0);
        return json(req, cartJson(next), next);
      }
      if (sub === "/add-item") {
        const id = String(f.id || "");
        const next = setQty(lines, id, qtyOf(lines, id) + Math.max(1, parseInt(f.quantity || "1", 10) || 1));
        return json(req, cartJson(next), next);
      }
    }
    return json(req, { code: "not_found" }, null, 404);
  }

  // Classic (non-ajax) "Add to cart" form on product pages: add and come back to the same page
  if (method === "POST") {
    const f = await readFields(req);
    const id = String(f["add-to-cart"] || "");
    if (id) {
      const lines = readCart(req);
      const next = getCatalog()[id] ? setQty(lines, id, qtyOf(lines, id) + Math.max(1, parseInt(f.quantity || "1", 10) || 1)) : lines;
      const headers = new Headers({ location: `${url.pathname}?added-to-cart=${encodeURIComponent(id)}` });
      headers.append("set-cookie", cookieHeader(req, next));
      return new Response(null, { status: 303, headers });
    }
    return null;
  }

  if (method === "GET" && /^\/checkout\/?$/.test(pathname)) return checkout(req); // GET only: never create a session on HEAD
  if (method === "GET" || method === "HEAD") {
    if (/^\/cart\/?$/.test(pathname)) return go("/shop/", 307);
    if (/^\/order-received\/?$/.test(pathname)) {
      const res = page("Thank you", `<h1>Thank you for your order!</h1><p>Your payment was received. We will confirm your delivery details on WhatsApp shortly.</p><a class="b" href="/shop/">Keep shopping</a>`);
      res.headers.append("set-cookie", cookieHeader(req, []));
      return res;
    }
  }
  return null;
}

/**
 * Injected into every HTML page: opens the mini-cart after a classic add-to-cart, hides Woo's dead
 * "View cart" link and keeps the floating badge in sync when the mini-cart changes quantities.
 */
export const HTML_PATCH =
  `<style>.added_to_cart.wc-forward{display:none!important}</style>` +
  `<script>(function(){var f=window.fetch;if(!f)return;window.fetch=function(u){var p=f.apply(this,arguments);try{if(String(u).indexOf("/wp-json/wc/store/v1/cart")>-1){p.then(function(r){return r.clone().json()}).then(function(j){if(j&&typeof j.items_count==="number"){var b=document.querySelector(".cvu-cart-fab-badge");if(b){b.setAttribute("data-count",j.items_count);b.textContent=j.items_count}}}).catch(function(){})}}catch(e){}return p}})()</script>` +
  `<script>if(/[?&]added-to-cart=/.test(location.search)){addEventListener("load",function(){setTimeout(function(){var f=document.getElementById("cvu-cart-fab");if(f)f.click()},700)})}</script>`;
