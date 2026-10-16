import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPages, getPosts, type Page } from "@/lib/data";

// Páginas de WooCommerce / administrativas que no aplican a este front.
const SKIP = new Set(["home", "shop", "cart", "checkout", "my-account", "doctor-dashboard", "meeting"]);

const all = (): Page[] => [...getPages().filter((p) => !SKIP.has(p.slug)), ...getPosts()];

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => all().map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = all().find((x) => x.slug === slug);
  return { title: p?.title, description: p?.excerpt || undefined };
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const p = all().find((x) => x.slug === slug);
  if (!p) notFound();
  return (
    <article>
      <h1 className="mx-auto mb-6 max-w-[60rem] text-3xl font-bold">{p.title}</h1>
      <div className="wp-content" dangerouslySetInnerHTML={{ __html: p.html }} />
    </article>
  );
}
