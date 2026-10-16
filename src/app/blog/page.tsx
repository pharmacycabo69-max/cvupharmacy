import type { Metadata } from "next";
import Link from "next/link";
import { getPosts } from "@/lib/data";

export const metadata: Metadata = { title: "Blog" };

export default function Blog() {
  const posts = [...getPosts()].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">Blog</h1>
      <ul className="grid gap-6 md:grid-cols-2">
        {posts.map((p) => (
          <li key={p.id} className="rounded-xl border border-soft p-5">
            <Link href={`/${p.slug}`} className="text-lg font-semibold hover:text-brand">{p.title}</Link>
            <p className="mt-2 line-clamp-3 text-sm text-muted">{p.excerpt}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
