import { Suspense } from "react";
import Link from "next/link";
import { StaffSearchForm } from "@/components/staff/staff-search-form";
import { STAFF_SEARCH_MIN_LENGTH, type StaffSearchResult } from "@/lib/staff-search";

export function StaffSearchResults({ result }: { result: StaffSearchResult }) {
  const total = result.sections.reduce((sum, section) => sum + section.hits.length, 0);

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <StaffSearchForm query={result.query} />
      </Suspense>

      {result.catalog.length === 0 ? (
        <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
          This staff role cannot search any records yet.
        </p>
      ) : result.tooShort ? (
        <div className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <p className="font-semibold text-brand">
            Type at least {STAFF_SEARCH_MIN_LENGTH} characters, or paste a
            record id.
          </p>
          <p className="mt-2 text-sm text-muted">
            Results stay limited to the areas this role can open.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {result.catalog.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="inline-flex rounded-full bg-mint px-3 py-1 text-xs font-bold text-brand"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm font-semibold text-brand">
          {total
            ? `${total} ${total === 1 ? "match" : "matches"} for “${result.query}”`
            : `No matches for “${result.query}” in the areas you can open.`}
        </p>
      )}

      {!result.tooShort
        ? result.sections.map((section) => (
            <section key={section.key}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold text-brand">
                  {section.label}
                </h2>
                <Link
                  href={section.href}
                  className="text-sm font-bold text-brand underline"
                >
                  Open
                </Link>
              </div>
              {section.hits.length ? (
                <ul className="mt-4 grid gap-3">
                  {section.hits.map((hit) => (
                    <li key={`${section.key}-${hit.id}`}>
                      <Link
                        href={hit.href}
                        className="block rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-extrabold text-brand">
                            {hit.title}
                          </h3>
                          {hit.badge ? (
                            <span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-brand">
                              {hit.badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          {hit.detail}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">No matches in this area.</p>
              )}
            </section>
          ))
        : null}
    </div>
  );
}
