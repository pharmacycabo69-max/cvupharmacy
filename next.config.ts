import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Igual que WordPress: /shop -> /shop/
  trailingSlash: true,
  // el catálogo del carrito y el índice de categorías se leen en tiempo de ejecución desde el servidor
  outputFileTracingIncludes: { "/[[...path]]": ["./data/catalog.json", "./data/category-index.json"] },
};

export default nextConfig;
