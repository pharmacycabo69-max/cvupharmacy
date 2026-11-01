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

/* ---------- datos de entrega (se piden en /checkout/ antes de ir a Stripe) ---------- */

const TIME_LABELS: Record<string, string> = {
  asap: "ASAP (30-60 min)", "1h": "Within 1 hour", "2h": "Within 2 hours",
  morning: "Tomorrow morning (9am-12pm)", afternoon: "Tomorrow afternoon (12pm-6pm)", evening: "Tomorrow evening (6pm-9pm)",
};
const RECV_LABELS: Record<string, string> = { self: "Recipient receives it personally", reception: "Leave at hotel reception" };
const COUNTRY_CODES = new Set(["+1", "+52", "+44", "+33", "+49", "+34"]);
const MAX_TIP_USD = 200;

export type Delivery = {
  name: string; phone: string; email: string;
  address: string; time: string; receiver: string; instructions: string; tipCents: number;
};

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Valida en el servidor lo que mandó el formulario; nunca se confía en el navegador. */
export function parseDelivery(raw: Record<string, unknown>): { ok: true; value: Delivery } | { ok: false; error: string } {
  const name = clean(raw.name, 80);
  if (name.length < 2) return { ok: false, error: "Please enter your full name." };

  const cc = clean(raw.countryCode, 4);
  const digits = String(raw.phone ?? "").replace(/\D/g, "");
  if (!COUNTRY_CODES.has(cc) || digits.length < 7 || digits.length > 15) return { ok: false, error: "Please enter a valid phone number." };

  const email = clean(raw.email, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Please enter a valid email address." };

  let address = "";
  const type = clean(raw.addrType, 10);
  if (type === "hotel") {
    const hotel = clean(raw.hotelName, 100), room = clean(raw.roomNumber, 20);
    if (!hotel) return { ok: false, error: "Please enter the hotel name." };
    address = `Hotel ${hotel}${room ? `, room ${room}` : ""}`;
  } else if (type === "airbnb") {
    const a = clean(raw.airbnbAddress, 160), unit = clean(raw.airbnbUnit, 40);
    if (!a) return { ok: false, error: "Please enter the Airbnb address." };
    address = `${a}${unit ? `, ${unit}` : ""}`;
  } else if (type === "other") {
    address = clean(raw.otherAddress, 200);
    if (!address) return { ok: false, error: "Please enter the delivery address." };
  } else return { ok: false, error: "Please choose where we deliver." };

  const time = String(raw.deliveryTime ?? "") in TIME_LABELS ? String(raw.deliveryTime) : "asap";
  const receiver = String(raw.deliveryRecv ?? "") in RECV_LABELS ? String(raw.deliveryRecv) : "self";

  const tipUsd = raw.tip === "other" ? parseFloat(String(raw.tipOther ?? "")) : Number(raw.tip ?? 0);
  if (!Number.isFinite(tipUsd) || tipUsd < 0 || tipUsd > MAX_TIP_USD) return { ok: false, error: `The tip must be between $0 and $${MAX_TIP_USD}.` };

  return {
    ok: true,
    value: { name, phone: `${cc} ${digits}`, email, address, time, receiver, instructions: clean(raw.instructions, 300), tipCents: Math.round(tipUsd * 100) },
  };
}

/**
 * Pure: turns cart lines into Stripe Checkout Session parameters (dynamic price_data, no Stripe products).
 * Con `delivery`, los datos ya se pidieron antes: Stripe no vuelve a preguntar teléfono ni dirección, los
 * muestra sobre el botón de pago y quedan en el pago (metadata y envío) para verlos en el panel.
 */
export function buildCheckoutParams(lines: CartLines, origin: string, delivery?: Delivery): URLSearchParams {
  const cat = getCatalog();
  const p = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/order-received/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/`,
    "metadata[source]": "cvupharmacy.com",
  });
  if (!delivery) {
    p.set("cancel_url", `${origin}/shop/`);
    p.set("phone_number_collection[enabled]", "true");
    p.set("shipping_address_collection[allowed_countries][0]", "MX");
  }
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

  if (delivery) {
    if (delivery.tipCents > 0) {
      const n = lines.length;
      p.set(`line_items[${n}][quantity]`, "1");
      p.set(`line_items[${n}][price_data][currency]`, "usd");
      p.set(`line_items[${n}][price_data][unit_amount]`, String(delivery.tipCents));
      p.set(`line_items[${n}][price_data][product_data][name]`, "Tip for the delivery team");
    }
    const meta: Record<string, string> = {
      customer_name: delivery.name,
      customer_phone: delivery.phone,
      delivery_address: delivery.address,
      delivery_time: TIME_LABELS[delivery.time],
      delivery_receiver: RECV_LABELS[delivery.receiver],
      delivery_instructions: delivery.instructions,
      tip_usd: (delivery.tipCents / 100).toFixed(2),
    };
    for (const [k, v] of Object.entries(meta)) {
      if (!v) continue;
      p.set(`metadata[${k}]`, v);
      p.set(`payment_intent_data[metadata][${k}]`, v);
    }
    p.set("customer_email", delivery.email);
    p.set("payment_intent_data[receipt_email]", delivery.email);
    p.set("payment_intent_data[shipping][name]", delivery.name);
    p.set("payment_intent_data[shipping][phone]", delivery.phone);
    p.set("payment_intent_data[shipping][address][line1]", delivery.address.slice(0, 200));
    p.set("payment_intent_data[shipping][address][city]", "Los Cabos");
    p.set("payment_intent_data[shipping][address][state]", "BCS");
    p.set("payment_intent_data[shipping][address][country]", "MX");
    // Resumen de la entrega sobre el botón de pago de Stripe
    p.set(
      "custom_text[submit][message]",
      `Delivering to ${delivery.address} · ${TIME_LABELS[delivery.time]} · ${RECV_LABELS[delivery.receiver]}. ` +
        `Contact: ${delivery.name}, ${delivery.phone}.` + (delivery.instructions ? ` Notes: ${delivery.instructions}` : ""),
    );
    p.set("custom_text[submit][message]", p.get("custom_text[submit][message]")!.slice(0, 1200));
  }
  return p;
}

const go = (to: string, status: number) => new Response(null, { status, headers: { location: to, "cache-control": "no-store" } });

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg?v=1" type="image/svg+xml"><title>${title}</title>` +
      `<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f6f8fb;color:#0f2540}main{max-width:460px;margin:24px;padding:32px;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(15,37,64,.08);text-align:center}a.b{display:inline-block;margin-top:18px;padding:13px 24px;border-radius:999px;background:#16a34a;color:#fff;text-decoration:none;font-weight:700}p{line-height:1.6}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

const err = (req: Request, status: number, message: string, extra: Record<string, unknown> = {}) =>
  json(req, { error: message, ...extra }, null, status);

/** POST /checkout/ (JSON con los datos de entrega): valida, crea la sesión de Stripe y devuelve su URL. */
async function startPayment(req: Request): Promise<Response> {
  const lines = readCart(req);
  if (!lines.length) return err(req, 400, "Your cart is empty.");
  const parsed = parseDelivery(await readFields(req));
  if (!parsed.ok) return err(req, 400, parsed.error);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set");
    return err(req, 503, "Online card payment is not available yet. Choose Pay on Delivery, or order on WhatsApp.", { whatsapp: WHATSAPP });
  }
  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: buildCheckoutParams(lines, originOf(req), parsed.value),
    });
    const data = (await r.json()) as { url?: string; error?: unknown };
    if (!r.ok || !data.url) {
      console.error("Stripe error", r.status, data.error);
      return err(req, 502, "We couldn't start the payment. Please try again, or order on WhatsApp.", { whatsapp: WHATSAPP });
    }
    return json(req, { url: data.url }, null);
  } catch (e) {
    console.error("Checkout failed", e);
    return err(req, 502, "We couldn't start the payment. Please try again, or order on WhatsApp.", { whatsapp: WHATSAPP });
  }
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** /order-received/: confirma el pago con Stripe y muestra los datos de entrega; sin pago confirmado no dice "recibido". */
async function orderReceived(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get("session_id") || "";
  const key = process.env.STRIPE_SECRET_KEY;
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id) || !key) return go("/shop/", 303);
  type Session = { payment_status?: string; metadata?: Record<string, string> };
  let s: Session | null = null;
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    if (r.ok) s = (await r.json()) as Session;
  } catch (e) {
    console.error("Order lookup failed", e);
  }
  if (!s) return page("Order status", `<h1>We couldn't confirm your payment</h1><p>If you were charged, don't worry: write to us on WhatsApp and we will check your order.</p><a class="b" href="${WHATSAPP}">Contact us on WhatsApp</a>`, 502);
  if (s.payment_status !== "paid") {
    return page("Payment not completed", `<h1>Your payment was not completed</h1><p>Your cart is still saved. You can try again whenever you are ready.</p><a class="b" href="/checkout/">Back to checkout</a>`);
  }
  const m = s.metadata || {};
  const row = (label: string, v?: string) => (v ? `<p style="margin:6px 0"><b>${label}</b><br>${esc(v)}</p>` : "");
  const res = page(
    "Thank you",
    `<h1>Thank you for your order!</h1><p>Your payment was received. We will confirm your delivery on WhatsApp shortly.</p>` +
      `<div style="text-align:left;background:#f6f8fb;border-radius:12px;padding:14px 18px;margin-top:14px">` +
      row("Delivering to", m.delivery_address) + row("When", m.delivery_time) + row("Receiver", m.delivery_receiver) +
      row("Contact", [m.customer_name, m.customer_phone].filter(Boolean).join(" · ")) + row("Notes", m.delivery_instructions) +
      `</div><a class="b" href="/shop/">Keep shopping</a>`,
  );
  res.headers.append("set-cookie", cookieHeader(req, []));
  return res;
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

  // El formulario de /checkout/ envía aquí los datos de entrega (JSON); responde con la URL de pago de Stripe
  if (method === "POST" && /^\/checkout\/?$/.test(pathname)) return startPayment(req);

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

  if (method === "GET" || method === "HEAD") {
    if (/^\/cart\/?$/.test(pathname)) return go("/shop/", 307);
    if (method === "GET" && /^\/order-received\/?$/.test(pathname)) return orderReceived(req); // GET: HEAD no consulta a Stripe
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
