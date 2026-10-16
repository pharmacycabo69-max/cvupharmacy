import fs from "node:fs";
import path from "node:path";

const DATA = path.join(process.cwd(), "data");
const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf-8"));

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'", "&#8217;": "’", "&#8211;": "–", "&nbsp;": " " };
export const decode = (s: string) =>
  s.replace(/&(#\d+|[a-z]+);/gi, (m) => ENTITIES[m] ?? (m.startsWith("&#") ? String.fromCharCode(Number(m.slice(2, -1))) : m));

export const localImage = (url: string) =>
  url.replace(/https?:\/\/cvupharmacy\.com\/wp-content\/uploads\//g, "/images/");

/** Reescribe URLs absolutas del sitio viejo a rutas locales dentro de HTML. */
export const localizeHtml = (html: string) =>
  localImage(html).replace(/https?:\/\/cvupharmacy\.com\/product-category\//g, "/category/")
    .replace(/https?:\/\/cvupharmacy\.com\/product\//g, "/product/")
    .replace(/https?:\/\/cvupharmacy\.com\//g, "/");

export type Category = { id: number; name: string; slug: string; parent: number; count: number; image: string | null };
export type Product = {
  id: number; name: string; slug: string; sku: string; price: number; regularPrice: number;
  onSale: boolean; inStock: boolean; image: string | null; images: string[];
  categories: { id: number; name: string; slug: string }[];
  short: string; description: string;
};
export type Page = { id: number; slug: string; title: string; html: string; date: string; excerpt: string };

type RawProduct = {
  id: number; name: string; slug: string; sku: string; on_sale: boolean; is_in_stock: boolean;
  prices: { price: string; regular_price: string; currency_minor_unit: number };
  images: { src: string }[]; categories: { id: number; name: string; slug: string }[];
  short_description: string; description: string;
};
type RawCategory = { id: number; name: string; slug: string; parent: number; count: number; image: { src: string } | null };
type RawPage = { id: number; slug: string; date: string; title: { rendered: string }; content: { rendered: string }; excerpt: { rendered: string } };

let cache: { products: Product[]; categories: Category[] } | null = null;

function load() {
  if (cache) return cache;
  const products = read<RawProduct[]>("products.json").map((p): Product => {
    const div = 10 ** (p.prices.currency_minor_unit ?? 2);
    return {
      id: p.id, name: decode(p.name), slug: p.slug, sku: p.sku,
      price: Number(p.prices.price) / div, regularPrice: Number(p.prices.regular_price) / div,
      onSale: p.on_sale, inStock: p.is_in_stock,
      image: p.images[0] ? localImage(p.images[0].src) : null,
      images: p.images.map((i) => localImage(i.src)),
      categories: p.categories.map((c) => ({ ...c, name: decode(c.name) })),
      short: localizeHtml(p.short_description), description: localizeHtml(p.description),
    };
  });
  const categories = read<RawCategory[]>("categories.json").map((c): Category => ({
    id: c.id, name: decode(c.name), slug: c.slug, parent: c.parent, count: c.count,
    image: c.image ? localImage(c.image.src) : null,
  }));
  return (cache = { products, categories });
}

export const getProducts = () => load().products;
export const getCategories = () => load().categories;
export const getProduct = (slug: string) => getProducts().find((p) => p.slug === slug);
export const getCategory = (slug: string) => getCategories().find((c) => c.slug === slug);
export const topCategories = () => getCategories().filter((c) => c.parent === 0 && c.count > 0);
export const childCategories = (id: number) => getCategories().filter((c) => c.parent === id && c.count > 0);

/** Productos de una categoría, incluyendo subcategorías. */
export function productsInCategory(cat: Category) {
  const ids = new Set([cat.id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of getCategories()) if (ids.has(c.parent) && !ids.has(c.id)) { ids.add(c.id); grew = true; }
  }
  return getProducts().filter((p) => p.categories.some((c) => ids.has(c.id)));
}

const toPage = (p: RawPage): Page => ({
  id: p.id, slug: p.slug, date: p.date, title: decode(p.title.rendered),
  html: localizeHtml(p.content.rendered), excerpt: decode(p.excerpt.rendered.replace(/<[^>]+>/g, "")).trim(),
});
let pages: Page[] | null = null, posts: Page[] | null = null;
export const getPages = () => (pages ??= read<RawPage[]>("pages.json").map(toPage));
export const getPosts = () => (posts ??= read<RawPage[]>("posts.json").map(toPage));

export const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
