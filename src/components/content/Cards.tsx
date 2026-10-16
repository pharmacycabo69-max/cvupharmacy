import Link from "next/link";
import type { Card } from "@/lib/content";

const isExternal = (href: string) => /^https?:\/\//.test(href);

function CardLink({ href, className, children }: { href?: string; className: string; children: React.ReactNode }) {
  if (!href) return <span className={className}>{children}</span>;
  return isExternal(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link href={href} className={className}>{children}</Link>;
}

/* eslint-disable @next/next/no-img-element */
function OfferCard({ c }: { c: Card }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-soft bg-white shadow-sm transition hover:shadow-md">
      {c.image && (
        <div className="relative aspect-[4/3] bg-soft">
          <img src={c.image} alt={c.title} loading="lazy" className="h-full w-full object-cover" />
          {c.badge && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-brand">{c.badge}</span>}
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          {c.category && <span className="text-xs font-semibold uppercase tracking-wide text-brand">{c.category}</span>}
          {!c.image && c.badge && <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">{c.badge}</span>}
        </div>
        <h3 className="mt-1 text-lg font-semibold">{c.title}</h3>
        {c.text && <p className="mt-2 text-sm text-muted">{c.text}</p>}
        {c.items && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">What’s inside</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {c.items.map((i) => <li key={i} className="rounded-full bg-soft px-2.5 py-0.5 text-xs">{i}</li>)}
            </ul>
          </div>
        )}
        {c.meta && <p className="mt-3 text-xs text-muted">{c.meta}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            {c.price && <span className="text-2xl font-bold text-ink">{c.price}</span>}
            {c.priceNote && <span className="block text-xs text-muted">{c.priceNote}</span>}
          </div>
          {c.href && (
            <CardLink href={c.href} className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">Book now</CardLink>
          )}
        </div>
      </div>
    </article>
  );
}

function StepCard({ c, i }: { c: Card; i: number }) {
  return (
    <article className="rounded-2xl border border-soft bg-white p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
      <h3 className="mt-3 font-semibold">{c.title}</h3>
      {c.text && <p className="mt-1 text-sm text-muted">{c.text}</p>}
    </article>
  );
}

function FeatureCard({ c }: { c: Card }) {
  return (
    <article className="rounded-2xl border border-soft bg-white p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-xl text-brand">{c.icon ?? "✦"}</span>
      <h3 className="mt-3 font-semibold">{c.title}</h3>
      {c.text && <p className="mt-1 text-sm text-muted">{c.text}</p>}
    </article>
  );
}

function ReviewCard({ c }: { c: Card }) {
  return (
    <figure className="rounded-2xl border border-soft bg-white p-5">
      <div className="text-amber-500" aria-label="5 stars">★★★★★</div>
      {c.text && <blockquote className="mt-2 text-sm leading-relaxed">{c.text}</blockquote>}
      <figcaption className="mt-3 text-sm font-semibold">{c.title}{c.badge && <span className="ml-2 font-normal text-muted">· {c.badge}</span>}</figcaption>
    </figure>
  );
}

function PlainCard({ c }: { c: Card }) {
  return (
    <CardLink href={c.href} className="group relative flex min-h-48 flex-col justify-end overflow-hidden rounded-2xl border border-soft bg-soft p-5">
      {c.image && <img src={c.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />}
      {c.image && <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />}
      <span className={`relative ${c.image ? "text-white" : ""}`}>
        {c.badge && <span className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-80">{c.badge}</span>}
        <span className="block font-semibold">{c.title}</span>
        {c.text && <span className="mt-1 block text-sm opacity-90">{c.text}</span>}
      </span>
    </CardLink>
  );
}

export function CardGrid({ cards }: { cards: Card[] }) {
  const v = cards[0].variant;
  const cols =
    v === "offer" ? "md:grid-cols-2 lg:grid-cols-3"
    : v === "step" ? "md:grid-cols-2 lg:grid-cols-4"
    : v === "review" ? "md:grid-cols-2 lg:grid-cols-3"
    : cards.length === 4 || cards.length > 6 ? "sm:grid-cols-2 lg:grid-cols-4"
    : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-5 ${cols}`}>
      {cards.map((c, i) =>
        c.variant === "offer" ? <OfferCard key={i} c={c} />
        : c.variant === "step" ? <StepCard key={i} c={c} i={i} />
        : c.variant === "review" ? <ReviewCard key={i} c={c} />
        : c.variant === "plain" ? <PlainCard key={i} c={c} />
        : <FeatureCard key={i} c={c} />,
      )}
    </div>
  );
}
