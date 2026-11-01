# CVU Pharmacy

Réplica de cvupharmacy.com servida desde Next.js. El diseño es exactamente el original: se usa su HTML, CSS y JS
(copiados con wget), no una reconstrucción.

## Uso

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
```

## Cómo funciona

- `mirror/` — copia estática del sitio (todas las URLs de los sitemaps: páginas, posts, categorías, etiquetas y
  3,280 productos, con sus CSS, JS e imágenes).
- `src/app/[[...path]]/route.ts` — único handler de la app: sirve `mirror/` en las mismas URLs del original
  (`/shop/`, `/product/<slug>/`…). Al vuelo corrige lo que wget deja distinto: enlaces `…/index.html`, archivos
  con `?ver=` en el nombre y rutas de assets que el JS arma con el dominio.
- `scraper/generate_sitemap.py` — genera los sitemaps (`mirror/sitemap_index.xml` y 7 más) a partir de las páginas de
  `mirror/`; se omiten las `noindex`. Ejecutar de nuevo si cambian las páginas.
- `scraper/scrape.py` + `data/` — datos estructurados (productos, categorías, páginas, posts) del scrape por API.
- Rama `nextjs-redesign` — el rediseño propio anterior (catálogo y páginas hechos con componentes de Next.js).

## Carrito y checkout dinámico (Stripe, sin productos registrados)

Los productos **no están registrados en Stripe**. El navegador solo envía ids y cantidades; el servidor toma nombre,
precio y foto de `data/catalog.json` y arma el cobro al vuelo con `price_data` (`src/lib/store.ts`).

- `data/catalog.json` — lista de precios compacta (2,489 productos comprables; los 791 con precio 0 no se venden).
  Regenerar si cambia `data/products.json`: `python3 -I scraper/build_catalog.py`.
- El carrito vive en la cookie `cvu_cart` (HttpOnly, `id:cantidad,…`, máx. 40 líneas y 20 por producto).
- Endpoints de WooCommerce que ya espera la interfaz del sitio (mini-carrito, botones "Add to cart", contador):
  `/?wc-ajax=add_to_cart`, `/?wc-ajax=get_refreshed_fragments`, `/wp-json/wc/store/v1/cart` (+ `update-item`,
  `remove-item`, `add-item`) y el formulario clásico de la página de producto.
- `/checkout/` crea la sesión de Stripe Checkout (envío solo a México, pide teléfono) y redirige. Sin
  `STRIPE_SECRET_KEY` muestra un aviso con WhatsApp. `/order-received/` confirma el pago y vacía el carrito.

Variables de entorno (Vercel): `STRIPE_SECRET_KEY` (requerida para cobrar) y `SITE_URL` (opcional; por defecto se usa
el dominio de la petición).

## Limitaciones

Es una copia estática: lo que necesita el servidor de WordPress/WooCommerce no funciona (búsqueda, login, `wp-json`);
el carrito y el checkout están reimplementados arriba. Para actualizar la copia hay que volver a descargar el sitio.
