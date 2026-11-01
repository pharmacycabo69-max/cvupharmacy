#!/usr/bin/env python3
"""Genera los sitemaps de cvupharmacy.com a partir de las páginas de mirror/.

Salida (en mirror/, que sirve la app en la raíz del sitio):
  sitemap_index.xml (y sitemap.xml, igual)  índice
  sitemap-pages.xml, sitemap-posts.xml, sitemap-products.xml,
  sitemap-product-categories.xml, sitemap-product-tags.xml,
  sitemap-post-tags.xml, sitemap-post-categories.xml, sitemap-authors.xml

Se omiten las páginas marcadas noindex (carrito, checkout, mi cuenta).
lastmod solo se escribe para páginas y posts, que lo traen en data/*.json.
Uso: python3 scraper/generate_sitemap.py
"""
import json
import os
import re
from urllib.parse import quote
from collections import defaultdict
from datetime import datetime, timezone
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIRROR = os.path.join(ROOT, "mirror")
HOST = "https://cvupharmacy.com"

TERM_DIRS = {
    "product-category": "sitemap-product-categories.xml",
    "product-tag": "sitemap-product-tags.xml",
    "tag": "sitemap-post-tags.xml",
    "category": "sitemap-post-categories.xml",
    "author": "sitemap-authors.xml",
}
NOINDEX = re.compile(r'<meta[^>]+name=["\']robots["\'][^>]*noindex', re.I)


def lastmods(name):
    with open(os.path.join(ROOT, "data", name), encoding="utf-8") as f:
        return {x["slug"]: x.get("modified_gmt") for x in json.load(f)}


def indexable_pages():
    out = []
    for d, _, files in os.walk(MIRROR):
        if "index.html" not in files:
            continue
        with open(os.path.join(d, "index.html"), encoding="utf-8", errors="ignore") as f:
            if NOINDEX.search(f.read(60000)):
                continue
        rel = os.path.relpath(d, MIRROR)
        out.append("" if rel == "." else rel.replace(os.sep, "/"))
    return sorted(out)


def write_sitemap(name, entries):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, mod in entries:
        # los caracteres no ASCII van codificados en porcentaje, como exige el protocolo
        loc = f"{HOST}/{quote(path, safe='/-._~%')}/" if path else f"{HOST}/"
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(loc)}</loc>")
        if mod:
            lines.append(f"    <lastmod>{mod}+00:00</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    with open(os.path.join(MIRROR, name), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len(entries)


def main():
    page_mod, post_mod = lastmods("pages.json"), lastmods("posts.json")
    groups = defaultdict(list)
    for path in indexable_pages():
        top = path.split("/")[0]
        if path == "":
            groups["sitemap-pages.xml"].append((path, page_mod.get("home")))
        elif top == "product" and path != "product":
            groups["sitemap-products.xml"].append((path, None))
        elif top in TERM_DIRS and path != top:
            groups[TERM_DIRS[top]].append((path, None))
        elif "/" not in path and path in post_mod:
            groups["sitemap-posts.xml"].append((path, post_mod[path]))
        elif "/" not in path:
            groups["sitemap-pages.xml"].append((path, page_mod.get(path)))

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    index = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    total = 0
    for name in sorted(groups):
        n = write_sitemap(name, groups[name])
        total += n
        print(f"{name}: {n} URLs")
        index += ["  <sitemap>", f"    <loc>{HOST}/{name}</loc>", f"    <lastmod>{now}</lastmod>", "  </sitemap>"]
    index.append("</sitemapindex>")
    for name in ("sitemap_index.xml", "sitemap.xml"):
        with open(os.path.join(MIRROR, name), "w", encoding="utf-8") as f:
            f.write("\n".join(index) + "\n")
    print(f"Total: {total} URLs en {len(groups)} sitemaps")


if __name__ == "__main__":
    main()
