import Link from "next/link";
import { getProducts, topCategories } from "@/lib/data";
import ProductCard from "@/components/ProductCard";

export default function Home() {
  const featured = getProducts().filter((p) => p.inStock && p.image).slice(0, 12);
  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-soft px-6 py-14 text-center">
        <h1 className="text-3xl font-bold md:text-5xl">24/7 Pharmacy Delivery in Cabo San Lucas</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted">
          OTC medications, vitamins and wellness essentials delivered to your hotel, villa or yacht by an English-speaking team.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/shop" className="rounded-full bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark">Shop now</Link>
          <a href="tel:+526242261023" className="rounded-full border border-brand px-6 py-3 font-medium text-brand">Call +52 624 226 1023</a>
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-2xl font-bold">Shop by category</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {topCategories().map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`} className="rounded-xl border border-soft p-4 text-center text-sm font-medium hover:border-brand hover:text-brand">
              {c.name}<span className="block text-xs font-normal text-muted">{c.count} products</span>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-2xl font-bold">Featured products</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
          {featured.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>
    </div>
  );
}
