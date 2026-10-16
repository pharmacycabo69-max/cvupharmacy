import Link from "next/link";
import { money, type Product } from "@/lib/data";

export default function ProductCard({ p }: { p: Product }) {
  return (
    <Link href={`/product/${p.slug}`} className="group flex flex-col rounded-xl border border-soft bg-white p-3 transition hover:shadow-md">
      <div className="aspect-square overflow-hidden rounded-lg bg-soft">
        {p.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-contain transition group-hover:scale-105" />
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-medium">{p.name}</h3>
      <div className="mt-auto pt-2 flex items-baseline gap-2">
        <span className="font-semibold text-brand">{money(p.price)}</span>
        {p.onSale && <span className="text-xs text-muted line-through">{money(p.regularPrice)}</span>}
      </div>
      {!p.inStock && <span className="text-xs text-red-600">Out of stock</span>}
    </Link>
  );
}
