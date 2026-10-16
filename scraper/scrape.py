#!/usr/bin/env python3
"""Scraper de cvupharmacy.com (WordPress + WooCommerce) usando sus APIs públicas.

Salida (relativa a la raíz del repo):
  data/products.json, data/products.csv, data/categories.json
  data/pages.json, data/posts.json
  site/pages/<slug>.html, site/posts/<slug>.html   (HTML renderizado)
  images/<ruta original bajo wp-content/uploads>
Reanudable: omite lo ya descargado.
"""
import csv, json, os, re, sys, time, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

BASE = "https://cvupharmacy.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0 (cvupharmacy-backup-scraper)"}
DELAY = 0.3


def get(url, binary=False, retries=4):
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                data = r.read()
                return data if binary else data.decode("utf-8")
        except Exception as e:
            if i == retries - 1:
                print("FALLO", url, e, file=sys.stderr)
                return None
            time.sleep(2 * (i + 1))


def paged(endpoint, per_page=100):
    out, page = [], 1
    while True:
        sep = "&" if "?" in endpoint else "?"
        raw = get(f"{BASE}{endpoint}{sep}per_page={per_page}&page={page}")
        time.sleep(DELAY)
        if not raw:
            break
        items = json.loads(raw)
        if not items:
            break
        out += items
        print(f"{endpoint} página {page}: {len(out)}", flush=True)
        if len(items) < per_page:
            break
        page += 1
    return out


def save_json(name, obj):
    os.makedirs(f"{ROOT}/data", exist_ok=True)
    with open(f"{ROOT}/data/{name}", "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def image_path(url):
    p = urllib.parse.urlparse(url).path
    m = re.search(r"/wp-content/uploads/(.+)$", p)
    return m.group(1) if m else None


def download_image(url):
    rel = image_path(url)
    if not rel:
        return
    dest = f"{ROOT}/images/{rel}"
    if os.path.exists(dest):
        return
    data = get(url, binary=True)
    if data:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(data)
    time.sleep(DELAY / 3)


def main():
    # Páginas y posts (HTML renderizado + JSON)
    for kind in ("pages", "posts"):
        items = paged(f"/wp-json/wp/v2/{kind}")
        save_json(f"{kind}.json", items)
        os.makedirs(f"{ROOT}/site/{kind}", exist_ok=True)
        for it in items:
            dest = f"{ROOT}/site/{kind}/{it['slug']}.html"
            if os.path.exists(dest):
                continue
            html = get(it["link"])
            time.sleep(DELAY)
            if html:
                with open(dest, "w", encoding="utf-8") as f:
                    f.write(html)
        print(f"{kind}: {len(items)} guardados", flush=True)

    # Home
    if not os.path.exists(f"{ROOT}/site/index.html"):
        html = get(BASE + "/")
        if html:
            with open(f"{ROOT}/site/index.html", "w", encoding="utf-8") as f:
                f.write(html)

    # Categorías y productos (Store API pública de WooCommerce)
    cats = paged("/wp-json/wc/store/v1/products/categories")
    save_json("categories.json", cats)
    products = paged("/wp-json/wc/store/v1/products")
    save_json("products.json", products)

    with open(f"{ROOT}/data/products.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "sku", "name", "slug", "price", "regular_price", "sale_price",
                    "currency", "categories", "in_stock", "permalink", "image", "short_description"])
        for p in products:
            pr, mi = p.get("prices", {}), p.get("currency_minor_unit", 2)
            mi = pr.get("currency_minor_unit", 2)
            money = lambda v: f"{int(v) / 10 ** mi:.{mi}f}" if v not in (None, "") else ""
            w.writerow([p["id"], p.get("sku"), p["name"], p["slug"], money(pr.get("price")),
                        money(pr.get("regular_price")), money(pr.get("sale_price")),
                        pr.get("currency_code"), " | ".join(c["name"] for c in p.get("categories", [])),
                        p.get("is_in_stock"), p["permalink"],
                        (p.get("images") or [{}])[0].get("src", ""),
                        re.sub(r"<[^>]+>", "", p.get("short_description", "")).strip()])

    # Imágenes
    urls = set()
    for p in products:
        for im in p.get("images", []):
            urls.add(im["src"])
    for c in cats:
        if c.get("image"):
            urls.add(c["image"]["src"])
    for it in json.load(open(f"{ROOT}/data/pages.json")) + json.load(open(f"{ROOT}/data/posts.json")):
        for m in re.findall(r'https://cvupharmacy\.com/wp-content/uploads/[^"\\\s\')]+', json.dumps(it)):
            urls.add(m.replace("\\/", "/"))
    urls = sorted(u for u in urls if image_path(u))
    print(f"Descargando {len(urls)} imágenes", flush=True)
    with ThreadPoolExecutor(max_workers=4) as ex:
        for i, _ in enumerate(ex.map(download_image, urls), 1):
            if i % 200 == 0:
                print(f"imágenes {i}/{len(urls)}", flush=True)
    print("LISTO", flush=True)


if __name__ == "__main__":
    main()
