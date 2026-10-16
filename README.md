# CVU Pharmacy

Reconstrucción en Next.js (App Router + Tailwind v4) de cvupharmacy.com, a partir de un scrape del sitio WordPress/WooCommerce original.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Estructura

- `data/` — JSON/CSV obtenidos del sitio (productos, categorías, páginas, posts).
- `public/images/` — imágenes descargadas (`wp-content/uploads` del sitio original).
- `src/lib/data.ts` — carga y normaliza los datos (precios, URLs locales).
- `src/app/` — rutas: `/`, `/shop`, `/category/[slug]`, `/product/[slug]`, `/search`, `/blog`, `/[slug]` (páginas y posts).
- `scraper/scrape.py` — `npm run scrape` vuelve a descargar todo (reanudable).

## Pendiente

- Carrito y checkout (hoy la compra es por teléfono).
- Las páginas de contenido (hoteles, servicios) son HTML de Elementor insertado tal cual; conviene rediseñarlas.
