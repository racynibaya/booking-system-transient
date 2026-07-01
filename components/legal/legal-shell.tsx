import type { ReactNode } from "react";

import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";

// Editorial legal-document shell — one layout for /terms and /privacy so they stay consistent.
// Fraunces (font-display) for the title + part headings, Geist body at a constrained ~70ch measure
// and generous line-height, a sticky table of contents on desktop, and a teal callout for the
// clauses that carry weight (e.g. the no-custody Section Z). On-brand "Slate & Tide", restrained.

export type LegalSection = {
  id: string;
  label: string; // section heading + TOC link text
  part: string; // grouping header, e.g. "Part A — Guest Terms"
  highlight?: boolean; // render in a tinted callout (for load-bearing clauses)
  body: ReactNode;
};

const BODY_PROSE =
  "text-body-md leading-[1.75] text-body space-y-3 " +
  "[&_strong]:font-semibold [&_strong]:text-ink " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-primary-active";

function tocGroups(sections: LegalSection[]) {
  const groups: { part: string; items: { id: string; label: string }[] }[] = [];
  for (const s of sections) {
    let g = groups.find((x) => x.part === s.part);
    if (!g) {
      g = { part: s.part, items: [] };
      groups.push(g);
    }
    g.items.push({ id: s.id, label: s.label });
  }
  return groups;
}

export function LegalShell({
  eyebrow = "Legal",
  title,
  subtitle,
  version,
  sections,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  version: string;
  sections: LegalSection[];
}) {
  const groups = tocGroups(sections);

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-canvas">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          {/* Header */}
          <header className="max-w-2xl">
            <p className="text-caption font-semibold tracking-[0.14em] text-primary uppercase">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-display text-display-lg text-ink">{title}</h1>
            <p className="mt-4 text-body-md leading-relaxed text-muted">{subtitle}</p>
            <p className="mt-5 border-t border-hairline pt-4 text-caption text-muted">{version}</p>
          </header>

          {/* Content + sticky TOC */}
          <div className="mt-12 grid gap-x-16 gap-y-10 lg:grid-cols-[1fr_220px]">
            <article className="order-2 max-w-2xl lg:order-1">
              {sections.map((s, i) => {
                const showPart = i === 0 || s.part !== sections[i - 1].part;
                return (
                  <section key={s.id} id={s.id} className="scroll-mt-28">
                    {showPart && (
                      <h2 className="mt-14 mb-6 font-display text-display-sm text-ink first:mt-0">
                        {s.part}
                      </h2>
                    )}
                    <div className={s.highlight ? "mt-8" : "mt-8"}>
                      {s.highlight ? (
                        <div className="rounded-xl border border-l-2 border-hairline border-l-primary bg-surface-soft p-6">
                          <h3 className="text-title-sm text-ink">{s.label}</h3>
                          <div className={`mt-3 ${BODY_PROSE}`}>{s.body}</div>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-title-sm text-ink">{s.label}</h3>
                          <div className={`mt-3 ${BODY_PROSE}`}>{s.body}</div>
                        </>
                      )}
                    </div>
                  </section>
                );
              })}
            </article>

            {/* TOC — desktop only; a legal doc benefits from navigability, not decoration */}
            <aside className="order-1 hidden lg:order-2 lg:block">
              <nav
                aria-label="On this page"
                className="sticky top-28 self-start border-l border-hairline pl-5"
              >
                <p className="text-caption font-semibold tracking-[0.12em] text-muted uppercase">
                  On this page
                </p>
                <div className="mt-4 space-y-5">
                  {groups.map((g) => (
                    <div key={g.part}>
                      <p className="text-caption-sm font-medium text-ink">{g.part}</p>
                      <ul className="mt-1.5 space-y-0.5">
                        {g.items.map((it) => (
                          <li key={it.id}>
                            <a
                              href={`#${it.id}`}
                              className="block rounded py-0.5 text-body-sm text-muted transition-colors hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                            >
                              {it.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </nav>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
