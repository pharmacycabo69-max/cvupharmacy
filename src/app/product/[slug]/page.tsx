import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getProducts, money } from "@/lib/data";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => getProducts().map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProduct((await params).slug);
  return { title: p?.name, openGraph: p?.image ? { images: [p.image] } : undefined };
}

export default async function ProductPage({ params }: Props) {
  const p = getProduct((await params).slug);
  if (!p) notFound();
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-3">
        <div className="aspect-square overflow-hidden rounded-2xl bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.image && <img src={p.image} alt={p.name} className="h-full w-full object-contain" />}
        </div>
        {p.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {p.images.slice(1).map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" loading="lazy" className="h-20 w-20 rounded-lg bg-soft object-contain" />
            ))}
          </div>
        )}
      </div>
      <div>
        <nav className="mb-2 text-sm text-muted">
          {p.categories.map((c, i) => (
            <span key={c.id}>{i > 0 && ", "}<Link href={`/category/${c.slug}`} className="hover:text-brand">{c.name}</Link></span>
          ))}
        </nav>
        <h1 className="text-2xl font-bold md:text-3xl">{p.name}</h1>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-semibold text-brand">{money(p.price)}</span>
          {p.onSale && <span className="text-muted line-through">{money(p.regularPrice)}</span>}
        </div>
        <p className={`mt-2 text-sm ${p.inStock ? "text-green-700" : "text-red-600"}`}>{p.inStock ? "In stock" : "Out of stock"}</p>
        {p.sku && <p className="mt-1 text-sm text-muted">SKU: {p.sku}</p>}
        <div className="wp-content mt-6" dangerouslySetInnerHTML={{ __html: p.description || p.short }} />
        <a href="tel:+526242261023" className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark">
          Order by phone: +52 624 226 1023
        </a>
      </div>
    </div>
  );
}
