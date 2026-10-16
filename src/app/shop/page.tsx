import type { Metadata } from "next";
import { getProducts } from "@/lib/data";
import ProductGrid from "@/components/ProductGrid";

export const metadata: Metadata = { title: "Shop" };

export default async function Shop({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">Shop</h1>
      <ProductGrid products={getProducts()} page={page} href={(p) => `/shop?page=${p}`} />
    </>
  );
}
