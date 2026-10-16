import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { childCategories, getCategories, getCategory, productsInCategory } from "@/lib/data";
import ProductGrid from "@/components/ProductGrid";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => getCategories().map((c) => ({ slug: c.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getCategory((await params).slug);
  return { title: c?.name };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const cat = getCategory(slug);
  if (!cat) notFound();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const subs = childCategories(cat.id);
  return (
    <>
      <h1 className="mb-4 text-3xl font-bold">{cat.name}</h1>
      {subs.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {subs.map((s) => (
            <Link key={s.id} href={`/category/${s.slug}`} className="rounded-full border border-soft px-4 py-1.5 text-sm hover:border-brand hover:text-brand">
              {s.name} <span className="text-muted">({s.count})</span>
            </Link>
          ))}
        </div>
      )}
      <ProductGrid products={productsInCategory(cat)} page={page} href={(p) => `/category/${slug}?page=${p}`} />
    </>
  );
}
