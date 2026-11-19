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
- `/checkout/` sirve el formulario original de la tienda, que pide los datos de entrega: contacto, hotel/Airbnb/otra
  dirección, hora, quién recibe, instrucciones y propina. Con **Pay by card**, el formulario envía esos datos
  (`POST /checkout/`); el servidor los valida, crea la sesión de Stripe Checkout (la propina va como una línea aparte)
  y redirige. Stripe ya no vuelve a pedir teléfono ni dirección: muestra el resumen de la entrega sobre el botón de
  pago y los datos quedan en el pago (metadata y envío) para verlos en el panel de Stripe. **Pay on delivery** sigue
  armando el mensaje de WhatsApp. Sin `STRIPE_SECRET_KEY` avisa y ofrece WhatsApp.
- El formulario de `/checkout/` es propio: `public/cvu-checkout.js` sustituye al formulario original de la copia
  (el handler cambia el script `#cvu-ck-js` por un cargador que solo actúa en `/checkout/`). Pide solo lo necesario:
  nombre, teléfono, correo, hotel/villa/dirección (+ habitación), cuándo y notas; la propina y la forma de pago son
  una fila cada una dentro del resumen. En escritorio cabe en una pantalla (dos columnas); en móvil va en una
  columna con el total y el botón fijos abajo. Errores junto a cada campo (sin popups), Enter pasa al siguiente
  campo, cursor en el primer campo vacío (solo con ratón) y código de país según el idioma del navegador. Los datos
  se recuerdan 7 días en el navegador del cliente.
- `/order-received/?session_id=…` consulta a Stripe: solo confirma el pago si está pagado y muestra los datos de
  entrega; sin un pago real redirige a la tienda. Vacía el carrito solo cuando el pago está confirmado.

Variables de entorno (Vercel): `STRIPE_SECRET_KEY` (requerida para cobrar) y `SITE_URL` (opcional; por defecto se usa
el dominio de la petición).

## SEO y conversión (`src/lib/seo.ts`)

Se aplica al vuelo sobre el HTML de `mirror/`; la copia no se modifica.

- **Contenido duplicado:** 13 páginas que competían por la misma búsqueda (mismo título o intención) redirigen con
  301 a la versión más completa (`CONSOLIDATE`). Los enlaces internos apuntan directo al destino. `hello-world` y
  las páginas de autor van a la portada.
- **noindex, follow:** etiquetas de blog y de producto, `category/uncategorized`, carrito, checkout, cuenta y
  páginas internas (`doctor-dashboard`, `meeting`). Se envía como meta y como cabecera `X-Robots-Tag`.
- **Sitemaps:** se sirven filtrados, sin URLs redirigidas o noindex; el índice ya no incluye etiquetas ni autores.
  **robots.txt** se genera en `ROBOTS_TXT`.
- **Limpieza del documento:** se quitan los bloques de Elementor ocultos en todos los dispositivos (en la portada,
  un documento HTML completo con otro `<title>`, canonical y fuente), los `<title>`/metas/canonical que había dentro
  del `<body>`, y la meta description duplicada de las fichas. Las 4 hojas de Google Fonts pasan a ser 1 petición.
- **Fichas de producto:** título y descripción con intención local ("… | Delivery in Cabo San Lucas", precio,
  entrega en menos de 60 min) y nombres en MAYÚSCULAS normalizados; schema `Product` + `Offer` (precio USD, en
  stock) para resultados enriquecidos y Google Merchant. Las frases plantilla de "shipping" pasan a entrega local.
  Las 791 fichas sin precio explican que se piden por WhatsApp en vez de mostrar un precio en blanco.
- **Portada:** schema `Pharmacy` (dirección de Plaza Gali, teléfono, horario de tienda 8:00–18:00, zona de reparto).
- **Autor:** los posts publicaban un correo personal como autor; ahora firma "CVU Pharmacy Team".
- **Páginas de hotel (`src/lib/hotels.ts`):** las 35 páginas "Pharmacy delivery to <hotel>" solo tenían el
  encabezado. Debajo se añade una guía por hotel y zona (Médano, Pacífico, Corredor, San José, East Cape): cómo
  funciona la entrega, qué se pide más (con enlaces a categorías), hoteles vecinos de la misma zona, atención
  médica, preguntas frecuentes (schema `FAQPage`) y botón de WhatsApp con el hotel ya escrito.
- **Enlaces externos:** se quitan los de pharmacyincabo.com (sitio ajeno) de las listas "Related". Los de
  cabopharmacy.com y cmcpharmacycabo.com se mantienen (son sitios propios).

## Limitaciones

Es una copia estática: lo que necesita el servidor de WordPress/WooCommerce no funciona (búsqueda, login, `wp-json`);
el carrito y el checkout están reimplementados arriba. Para actualizar la copia hay que volver a descargar el sitio.
