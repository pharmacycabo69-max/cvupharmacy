import Link from "next/link";
import type { PageModel, Section } from "@/lib/content";
import { PHONE, PHONE_HREF, WHATSAPP } from "@/lib/site";
import { CardGrid } from "./Cards";

const btnPrimary = "inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 font-medium text-white shadow-sm hover:bg-brand-dark";
const btnOutline = "inline-flex items-center justify-center rounded-full border border-brand bg-white px-6 py-3 font-medium text-brand hover:bg-brand/5";

function Ctas() {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className={btnPrimary}>💬 WhatsApp us</a>
      <a href={PHONE_HREF} className={btnOutline}>📞 Call {PHONE}</a>
    </div>
  );
}

function Prose({ html, className = "" }: { html: string[]; className?: string }) {
  if (!html.length) return null;
  return <div className={`wp-content ${className}`} dangerouslySetInnerHTML={{ __html: html.join("") }} />;
}

function SectionBlock({ s, i, article }: { s: Section; i: number; article: boolean }) {
  const hasCards = s.cards.length > 0;
  return (
    <section className={article ? "py-6" : `py-12 ${i % 2 ? "bg-soft/60" : ""}`}>
      <div className={`mx-auto px-4 ${hasCards ? "max-w-6xl" : article ? "max-w-3xl" : "max-w-4xl"}`}>
        {s.title && <h2 className="font-display text-2xl font-bold md:text-3xl">{s.title}</h2>}
        <Prose html={s.prose} className={`mx-0 ${s.title ? "mt-4" : ""} ${hasCards ? "max-w-3xl" : "max-w-none"}`} />
        {hasCards && <div className="mt-8"><CardGrid cards={s.cards} /></div>}
        {s.faq.length > 0 && (
          <div className="mt-6 divide-y divide-soft rounded-2xl border border-soft bg-white">
            {s.faq.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}<span className="text-brand transition group-open:rotate-45">+</span>
                </summary>
                <div className="wp-content mx-0 mt-3 max-w-none text-muted" dangerouslySetInnerHTML={{ __html: f.a }} />
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function ContentPage({ m, date }: { m: PageModel; date?: string }) {
  const landing = m.heroCards.length > 0 || m.trust.length > 0 || m.sections.some((s) => s.cards.length > 0);
  return (
    <div className="-mx-4 -my-8">
      <header className={landing ? "bg-gradient-to-b from-brand/10 to-white" : "border-b border-soft bg-soft/50"}>
        <div className={`mx-auto px-4 ${landing ? "max-w-5xl py-16 text-center" : "max-w-3xl py-12"}`}>
          {!landing && (
            <nav className="mb-4 text-sm text-muted">
              <Link href="/" className="hover:text-brand">Home</Link> › <span>{date ? "Blog" : "Info"}</span>
            </nav>
          )}
          {m.eyebrow && (
            <span className="mb-4 inline-block rounded-full bg-brand/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand">{m.eyebrow}</span>
          )}
          <h1 className={`font-display font-bold leading-tight ${landing ? "text-4xl md:text-5xl" : "text-3xl md:text-5xl"}`}>{m.title}</h1>
          {date && <p className="mt-3 text-sm text-muted">{new Date(date).toLocaleDateString("en-US", { dateStyle: "long" })}</p>}
          {m.lead && <p className={`mt-5 text-lg text-muted ${landing ? "mx-auto max-w-3xl" : ""}`}>{m.lead}</p>}
          {landing && <div className="mt-8"><Ctas /></div>}
          {m.trust.length > 0 && (
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
              {m.trust.map((t) => <li key={t}>{/^[\x00-\x7F]/.test(t) ? "✓ " : ""}{t}</li>)}
            </ul>
          )}
          {m.micro && <p className="mt-4 text-sm text-muted">{m.micro}</p>}
        </div>
        {m.heroCards.length > 0 && (
          <div className="mx-auto max-w-6xl px-4 pb-14 text-left"><CardGrid cards={m.heroCards} /></div>
        )}
      </header>

      {m.sections.map((s, i) => <SectionBlock key={i} s={s} i={i} article={!landing} />)}

      {m.cta ? (
        <section className="px-4 py-12">
          <div className="mx-auto max-w-4xl rounded-3xl bg-brand px-6 py-12 text-center text-white">
            <h2 className="font-display text-2xl font-bold md:text-3xl">{m.cta.title}</h2>
            {m.cta.text && <p className="mx-auto mt-3 max-w-2xl opacity-90">{m.cta.text}</p>}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-6 py-3 font-medium text-brand hover:bg-soft">💬 WhatsApp us</a>
              <a href={PHONE_HREF} className="rounded-full border border-white/70 px-6 py-3 font-medium hover:bg-white/10">📞 Call {PHONE}</a>
            </div>
          </div>
          {(m.cta.fine?.length || m.disclaimer) && (
            <div className="mx-auto mt-6 max-w-4xl text-xs text-muted">
              <Prose html={m.cta.fine ?? []} className="mx-0 max-w-none text-xs leading-relaxed" />
              {m.disclaimer && <p>{m.disclaimer}</p>}
            </div>
          )}
        </section>
      ) : (
        <section className="px-4 py-10">
          <div className="mx-auto max-w-3xl rounded-2xl bg-soft p-6 text-center">
            <p className="mb-4 font-semibold">Need something delivered in Cabo?</p>
            <Ctas />
          </div>
          {m.disclaimer && <p className="mx-auto mt-6 max-w-3xl text-xs text-muted">{m.disclaimer}</p>}
        </section>
      )}
    </div>
  );
}
