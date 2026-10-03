"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { UiMessageKey } from "@/lib/i18n";

export function LedgerFacultyView({
  titleKey,
  helpKey,
  tiles,
  rows,
  emptyKey,
  hideEmpty = false,
  manageHref,
  manageKey,
  extraHref,
  extraKey,
}: {
  titleKey: UiMessageKey;
  helpKey: UiMessageKey;
  tiles: { labelKey: UiMessageKey; value: string | number }[];
  rows: { id: string; title: string; meta: string }[];
  emptyKey: UiMessageKey;
  hideEmpty?: boolean;
  manageHref?: string | null;
  manageKey: UiMessageKey;
  extraHref?: string | null;
  extraKey?: UiMessageKey;
}) {
  const t = useT();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t(titleKey)}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t(helpKey)}</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.labelKey} className="rounded-2xl bg-mint px-4 py-3">
            <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
              {t(tile.labelKey)}
            </dt>
            <dd className="mt-1 font-bold text-brand">{tile.value}</dd>
          </div>
        ))}
      </dl>
      {rows.length ? (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-line px-4 py-3 text-sm"
            >
              <p className="font-bold capitalize text-brand">{row.title}</p>
              <p className="mt-1 text-muted">{row.meta}</p>
            </li>
          ))}
        </ul>
      ) : hideEmpty ? null : (
        <p className="mt-4 text-sm text-muted">{t(emptyKey)}</p>
      )}
      {manageHref || extraHref ? (
        <div className="mt-4 flex flex-wrap gap-4">
          {manageHref ? (
            <Link
              href={manageHref}
              className="text-sm font-bold text-brand-accent underline"
            >
              {t(manageKey)}
            </Link>
          ) : null}
          {extraHref && extraKey ? (
            <Link
              href={extraHref}
              className="text-sm font-bold text-brand-accent underline"
            >
              {t(extraKey)}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
