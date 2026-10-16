import Link from "next/link";

export const PAGE_SIZE = 24;

export default function Pagination({ page, total, href }: { page: number; total: number; href: (p: number) => string }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  const cls = "rounded-lg border border-soft px-4 py-2 text-sm hover:bg-soft";
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
      {page > 1 && <Link className={cls} href={href(page - 1)}>← Previous</Link>}
      <span className="text-sm text-muted">Page {page} of {pages}</span>
      {page < pages && <Link className={cls} href={href(page + 1)}>Next →</Link>}
    </nav>
  );
}
