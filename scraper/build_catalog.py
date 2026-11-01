"""Builds data/catalog.json: the compact, server-side price list used by the cart and the dynamic
Stripe checkout. Only products that can actually be bought (purchasable, in stock, price > 0).
Prices are integer cents (USD). Run again whenever data/products.json changes:
    python3 -I scraper/build_catalog.py
"""
import html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "products.json")
OUT = os.path.join(ROOT, "data", "catalog.json")


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


products = json.load(open(SRC, encoding="utf-8"))
catalog, skipped = {}, {"not_purchasable": 0, "out_of_stock": 0, "no_price": 0}
for p in products:
    price = (p.get("prices") or {}).get("price") or "0"
    if not p.get("is_purchasable"):
        skipped["not_purchasable"] += 1
        continue
    if not p.get("is_in_stock"):
        skipped["out_of_stock"] += 1
        continue
    if not price.isdigit() or int(price) <= 0:
        skipped["no_price"] += 1
        continue
    img = (p.get("images") or [{}])[0]
    catalog[str(p["id"])] = {
        "n": clean(p["name"]),
        "p": int(price),                      # cents
        "s": p.get("sku") or "",
        "i": img.get("src") or "",            # absolute image URL (Stripe needs a public https URL)
        "t": img.get("thumbnail") or img.get("src") or "",
    }

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, separators=(",", ":"))
print(f"{len(catalog)} purchasable products -> {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT)//1024} KB); skipped: {skipped}")
