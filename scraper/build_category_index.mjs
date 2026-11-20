// Genera data/category-index.json a partir de data/products.json (16 MB) para paginar /shop/ y las categorías.
// Uso: node scraper/build_category_index.mjs
//
// p: id -> [slug, nombre, miniatura (ruta /wp-content/...), precio en centavos, en stock (1/0)]
// c: ruta de categoría ("pain-relief", "personal-care/body-care") -> ids ordenados por nombre (como WooCommerce)
//    "" = todos los productos (/shop/). Una categoría incluye los productos de sus subcategorías.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const products = JSON.parse(fs.readFileSync(path.join(root, "data", "products.json"), "utf-8"));

const local = (u) => (u || "").replace(/^https?:\/\/(?:www\.)?cvupharmacy\.com/, "");
const p = {};
const c = { "": [] };
const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.id - b.id;

for (const it of [...products].sort(byName)) {
  const img = it.images?.[0];
  p[it.id] = [it.slug, it.name, local(img?.thumbnail || img?.src || ""), Number(it.prices?.price || 0), it.is_in_stock ? 1 : 0];
  c[""].push(it.id);
  const paths = new Set();
  for (const cat of it.categories || []) {
    const m = /\/product-category\/(.+?)\/?$/.exec(cat.link || "");
    if (!m) continue;
    const parts = m[1].split("/");
    for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join("/"));
  }
  for (const k of paths) (c[k] ||= []).push(it.id);
}

fs.writeFileSync(path.join(root, "data", "category-index.json"), JSON.stringify({ p, c }));
console.log(`productos: ${Object.keys(p).length}, categorías: ${Object.keys(c).length - 1}`);
