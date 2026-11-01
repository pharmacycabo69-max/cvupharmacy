import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Igual que WordPress: /shop -> /shop/
  trailingSlash: true,
  // el catálogo del carrito se lee en tiempo de ejecución desde el servidor
  outputFileTracingIncludes: { "/[[...path]]": ["./data/catalog.json"] },
};

export default nextConfig;
