import type { Product } from "@/lib/data";
import ProductCard from "./ProductCard";
import Pagination, { PAGE_SIZE } from "./Pagination";

export default function ProductGrid({ products, page, href }: { products: Product[]; page: number; href: (p: number) => string }) {
  const slice = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (!products.length) return <p className="py-12 text-center text-muted">No products found.</p>;
  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {slice.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
      <Pagination page={page} total={products.length} href={href} />
    </>
  );
}
