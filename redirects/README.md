# Migración de cvupharmacy.com a https://www.rmcpharmacy.com

Estado: **preparado, no desplegado.** Next.js que sirve la réplica del sitio. CVU Pharmacy es la razón social de RMC; el catálogo de receta no se promociona: los productos van a /pharmacy y los temas de receta al inicio.

- `vercel.json`: 349 reglas 301 (cada página con y sin barra final, patrones y un comodín al final).
  `robots.txt` y `sitemap*.xml` no se redirigen a propósito (Search Console los necesita).
- `redirects/redirects-map.csv`: 168 URLs viejas con su destino y el motivo.

Destinos más usados:
- `/delivery`: 58
- `/blog`: 56
- `/services/doctor-consultation`: 13
- `/`: 9
- `/pharmacy`: 6
- `/delivery/medano`: 6
- `/services/iv-therapy`: 3
- `/delivery/palmilla`: 3
- `/delivery/pacifico-sunset`: 3
- `/delivery/marina-centro`: 2
- `/delivery/pedregal`: 2
- `/delivery/puerto-los-cabos`: 2

Antes de publicar
1. Revisa el CSV y cambia cualquier destino que no te convenza (después regenera o edita `vercel.json`).
2. Despliega la rama y comprueba con `curl -I https://www.cvupharmacy.com/<ruta>`: debe dar 301 a un solo salto.
3. En Vercel → Domains, el dominio sin www no debe redirigir a otro lado antes (un solo salto).
4. Agrega la propiedad en Search Console y mantén el dominio y las redirecciones al menos 12 meses.
