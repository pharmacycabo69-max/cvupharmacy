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
- `scraper/scrape.py` + `data/` — datos estructurados (productos, categorías, páginas, posts) del scrape por API.
- Rama `nextjs-redesign` — el rediseño propio anterior (catálogo y páginas hechos con componentes de Next.js).

## Limitaciones

Es una copia estática: lo que necesita el servidor de WordPress/WooCommerce no funciona (carrito, checkout,
búsqueda, login, `wp-json`). Para actualizar la copia hay que volver a descargar el sitio.
