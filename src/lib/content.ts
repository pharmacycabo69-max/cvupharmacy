import { parse, HTMLElement, Node, NodeType } from "node-html-parser";
import * as parse5 from "parse5";
import type { Page } from "./data";

export type Card = {
  variant: "plain" | "step" | "trust" | "feature" | "offer" | "review";
  title: string;
  text?: string;
  category?: string;
  badge?: string;
  price?: string;
  priceNote?: string;
  image?: string;
  href?: string;
  items?: string[];
  meta?: string;
  icon?: string;
  num?: string;
};
export type Section = { title?: string; prose: string[]; cards: Card[]; faq: { q: string; a: string }[] };
export type PageModel = {
  title: string;
  eyebrow?: string;
  lead?: string;
  trust: string[];
  micro?: string;
  heroCards: Card[];
  sections: Section[];
  cta?: { title: string; text?: string; fine?: string[] };
  disclaimer?: string;
};

const SKIP_TAGS = new Set(["NAV", "FOOTER", "HEADER", "BUTTON", "FORM", "SVG", "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "HEAD", "TITLE", "META", "LINK", "INPUT", "SELECT", "TEXTAREA"]);
const SKIP_CLASS = /(^|-)(nav|drawer|burger|modal|footer|chips?|filter|top|nav-cta)(-|$)/;
const ALLOWED = new Set(["P", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "A", "H3", "H4", "BLOCKQUOTE", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "BR", "IMG"]);

const classes = (n: HTMLElement) => (n.getAttribute("class") || "").split(/\s+/).filter(Boolean);
const has = (n: HTMLElement, re: RegExp) => classes(n).some((c) => re.test(c));
const within = (n: Node, ancestor?: Node): boolean => {
  for (let c: Node | null = n; c; c = c.parentNode) if (c === ancestor) return true;
  return false;
};
const isEl = (n: Node): n is HTMLElement => n.nodeType === NodeType.ELEMENT_NODE;
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const text = (n: Node) => squash(n.text);
/** Como text(), pero separa elementos hermanos con un espacio ("$200" + "USD" -> "$200 USD"). */
const spaced = (n: Node): string => (n.nodeType === NodeType.TEXT_NODE ? n.text : n.childNodes.map(spaced).join(" "));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Serializa HTML conservando solo etiquetas y atributos seguros. */
function clean(n: Node): string {
  if (n.nodeType === NodeType.TEXT_NODE) return esc(n.text);
  if (!isEl(n)) return "";
  if (SKIP_TAGS.has(n.tagName) || n.tagName === "SVG") return "";
  const inner = n.childNodes.map(clean).join("");
  if (!ALLOWED.has(n.tagName)) return inner;
  const tag = n.tagName.toLowerCase();
  if (tag === "br") return "<br>";
  if (tag === "img") return n.getAttribute("src") ? `<img src="${esc(n.getAttribute("src")!)}" alt="${esc(n.getAttribute("alt") || "")}" loading="lazy">` : "";
  if (tag === "a") {
    const href = n.getAttribute("href");
    if (!href || /^\s*javascript:/i.test(href)) return inner;
    const ext = /^https?:\/\//.test(href) && !href.includes("cvupharmacy.com");
    return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${inner}</a>`;
  }
  if (!squash(n.text) && tag !== "table" && !n.querySelector("img")) return "";
  return `<${tag}>${inner}</${tag}>`;
}

const isContact = (n: HTMLElement) => {
  const links = n.querySelectorAll("a");
  return links.length > 0 && links.every((a) => /wa\.me|tel:/.test(a.getAttribute("href") || "")) && text(n).length < 80;
};

const SITE_LINK = /^\/(home-doctor|iv-therapy|nurse-care|video-consultation|privacy-policy|terms-of-service|refund-policy|cookie-policy)?\/?$/;
/** Pie de página incrustado en cada página: copyright y lista de enlaces a los servicios. */
const isFooterCruft = (n: HTMLElement) => {
  if (n.tagName === "P") return /^©/.test(text(n));
  if (n.tagName !== "UL") return false;
  const lis = n.querySelectorAll("li");
  const siteLinks = lis.filter((li) => SITE_LINK.test(li.querySelector("a")?.getAttribute("href") || ""));
  return siteLinks.length >= 3 && lis.every((li) => li.querySelector("a"));
};
const isCard = (n: HTMLElement) => n.tagName === "ARTICLE" || has(n, /(^|-)(card|step|trust-item)$|^(st|rv|oc)$/);

function variantOf(n: HTMLElement, hasPrice: boolean): Card["variant"] {
  const c = classes(n).join(" ");
  if (n.querySelector("blockquote") || /(^| )(rv|rvm|cvu-rvm-card)/.test(c)) return "review";
  if (/step/.test(c) || (/^st$/.test(classes(n)[0] ?? "") && has(n.parentNode as HTMLElement, /steps/))) return "step";
  if (/trust/.test(c)) return "trust";
  if (hasPrice || /menu|pop|iv-card/.test(c)) return "offer";
  if (/feature/.test(c)) return "feature";
  return "plain";
}

function bgImage(n: HTMLElement): string | undefined {
  for (const el of [n, ...n.querySelectorAll("*")]) {
    const m = (el.getAttribute("style") || "").match(/url\(['"]?([^'")]+)['"]?\)/);
    if (m) return m[1];
  }
  return n.querySelector("img")?.getAttribute("src") || undefined;
}

function extractCard(n: HTMLElement): Card | null {
  const titleEl = n.querySelector("h3, h4, h5") || n.querySelector("figcaption b, .who b, b, strong");
  const title = titleEl ? text(titleEl) : "";
  if (!title) return null;
  const q = (re: RegExp) => n.querySelectorAll("*").find((e) => has(e, re));
  const priceEl = q(/price/);
  let price: string | undefined, priceNote: string | undefined;
  if (priceEl) {
    const t = squash(spaced(priceEl));
    const m = t.match(/\$\s?[\d,.]+/);
    price = m ? m[0].replace(/\s/g, "") : t;
    const note = squash(t.replace(m?.[0] ?? "", "")).replace(/^[·\s]+/, "");
    priceNote = note || undefined;
  }
  const textEl = n.querySelector("blockquote") || q(/benefit|(^|-)(ds|desc|text)$/) || n.querySelectorAll("p").find((p) => p !== priceEl && !within(p, priceEl) && !has(p, /ideal|meta|price/) && text(p) !== title);
  const iconEl = q(/icon/);
  const iconTxt = iconEl && !iconEl.querySelector("svg") ? text(iconEl) : "";
  const items = n.querySelectorAll("li").map(text).filter(Boolean);
  const href = n.tagName === "A" ? n.getAttribute("href") || undefined : (n.querySelectorAll("a").find((a) => has(a, /book/)) || n.querySelector("a"))?.getAttribute("href") || undefined;
  return {
    variant: variantOf(n, !!price),
    title,
    text: textEl ? text(textEl) : undefined,
    category: (() => { const e = q(/(^|-)cat$|eyebrow|kicker/); return e ? text(e) : undefined; })(),
    badge: (() => { const e = q(/badge|tag$/); return e ? text(e) : undefined; })(),
    price, priceNote,
    image: bgImage(n),
    href,
    items: items.length ? items : undefined,
    meta: (() => { const e = q(/ideal|meta/); return e ? text(e) : undefined; })(),
    icon: iconTxt && iconTxt.length <= 4 ? iconTxt : undefined,
    num: (() => { const e = q(/num$/); return e ? text(e) : undefined; })(),
  };
}

export function buildModel(page: Page, withDate = false): PageModel {
  // parse5 sigue el estándar HTML5 (cierra <p> abiertos, descarta doctype/head) y devuelve HTML bien formado.
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(parse5.serialize(parse5.parse(page.html)))?.[1] ?? page.html;
  const root = parse(body.replace(/<(style|script|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ""));
  const m: PageModel = { title: page.title, trust: [], heroCards: [], sections: [] };
  let titled = false;
  let cur: Section | null = null;
  const intro: Section = { prose: [], cards: [], faq: [] };
  const target = () => cur ?? intro;

  const walk = (n: Node) => {
    if (!isEl(n)) return;
    if (SKIP_TAGS.has(n.tagName)) return;
    if (has(n, SKIP_CLASS) || has(n, /^elementor-hidden-desktop$/) && has(n, /^elementor-hidden-tablet$/)) return;
    if (has(n, /disclaimer/)) { m.disclaimer = text(n); return; }
    if (has(n, /cta-section|cta-final|final-cta/)) {
      const t = n.querySelector("h2, h3");
      m.cta = { title: t ? text(t) : "", text: n.querySelectorAll("p").map(text).find((s) => s.length > 20) };
      return;
    }
    if (has(n, /hero-trust$|trust-strip$/)) {
      m.trust = n.querySelectorAll("span, div").filter((e) => !e.querySelector("span, div") && text(e)).map(text);
      return;
    }
    if (has(n, /micro$/) && !m.micro) { m.micro = text(n); return; }
    if (n.tagName === "H1") { if (!titled) { m.title = text(n); titled = true; } return; }
    if (has(n, /eyebrow/) && !m.eyebrow && !cur) { m.eyebrow = text(n); return; }
    if (n.tagName === "DIV" && has(n, /^elementor-heading-title$/) && !m.eyebrow && !cur && !n.querySelector("*")) { m.eyebrow = text(n); return; }
    if (has(n, /lead$/) && !m.lead) { m.lead = text(n); return; }
    if (isCard(n)) {
      const c = extractCard(n);
      if (c) (cur ? cur.cards : m.heroCards).push(c);
      return;
    }
    if (n.tagName === "DETAILS") {
      const s = n.querySelector("summary");
      const q = s ? text(s) : "";
      const a = n.childNodes.filter((c) => c !== s).map(clean).join("").trim();
      if (q) target().faq.push({ q, a: a.startsWith("<") ? a : `<p>${a}</p>` });
      return;
    }
    if (n.tagName === "H2") {
      const t = text(n);
      if (/^table of contents$/i.test(t)) { cur = { prose: [], cards: [], faq: [] }; return; }
      if (!t || (cur && cur.title === t && !cur.prose.length && !cur.cards.length)) return;
      cur = { title: t, prose: [], cards: [], faq: [] };
      m.sections.push(cur);
      return;
    }
    if (n.tagName === "P" && !cur && !m.eyebrow && n.querySelector("[class*=eyebrow]")) { m.eyebrow = text(n); return; }
    if (["P", "UL", "OL", "BLOCKQUOTE", "TABLE", "H3", "H4"].includes(n.tagName)) {
      if (isContact(n) || isFooterCruft(n)) return;
      if (n.tagName === "P" && !cur && titled && !m.lead && text(n).length > 30) { m.lead = text(n); return; }
      const html = clean(n);
      if (html) target().prose.push(html);
      return;
    }
    n.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);

  if (!titled) m.title = page.title;
  if (!m.lead && !withDate && intro.prose.length && /^<p>/.test(intro.prose[0])) {
    m.lead = text(parse(intro.prose.shift()!));
  }
  if (intro.prose.length || intro.cards.length || intro.faq.length) m.sections.unshift(intro);

  // Última sección corta con forma de llamado a la acción -> CTA.
  for (const sec of [...m.sections, { cards: m.heroCards }]) {
    const seen = new Set<string>();
    sec.cards = sec.cards.filter((c) => !seen.has(c.title + c.text) && seen.add(c.title + c.text));
  }
  const last = m.sections[m.sections.length - 1];
  if (!m.cta && last?.title && m.sections.length > 1 && !last.cards.length && !last.faq.length && /\?|book|order|get |need|ready|call/i.test(last.title)) {
    m.cta = { title: last.title, text: last.prose[0] ? text(parse(last.prose[0])) : undefined, fine: last.prose.slice(1).filter((h) => !/^<p>(Available|Free|\d)/.test(h) || h.length > 90) };
    m.sections.pop();
  }

  return m;
}

const cache = new Map<number, PageModel>();
export const modelFor = (page: Page, withDate = false) => {
  let v = cache.get(page.id);
  if (!v) cache.set(page.id, (v = buildModel(page, withDate)));
  return v;
};
