import type { Metadata } from "next";
import { getProducts } from "@/lib/data";
import ProductGrid from "@/components/ProductGrid";

export const metadata: Metadata = { title: "Search" };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = "", page: pg } = await searchParams;
  const page = Math.max(1, Number(pg) || 1);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const results = terms.length
    ? getProducts().filter((p) => {
        const hay = `${p.name} ${p.sku} ${p.categories.map((c) => c.name).join(" ")}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
    : [];
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">{q ? `Results for “${q}”` : "Search"} <span className="text-base font-normal text-muted">{q && `(${results.length})`}</span></h1>
      <ProductGrid products={results} page={page} href={(p) => `/search?q=${encodeURIComponent(q)}&page=${p}`} />
    </>
  );
}
