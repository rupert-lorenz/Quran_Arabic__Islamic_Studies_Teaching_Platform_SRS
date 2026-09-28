"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getOneOffPaymentsFaculty } from "@/server/finance/one-off-payments";

type Faculty = Awaited<ReturnType<typeof getOneOffPaymentsFaculty>>;

export function OneOffPaymentsFacultyView({
  faculty,
  manageHref,
  hideCounterpartyNames = false,
}: {
  faculty: Faculty;
  manageHref?: string | null;
  hideCounterpartyNames?: boolean;
}) {
  const t = useT();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("one_off.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {t("one_off.faculty.help")}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("one_off.faculty.payments")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.payments}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("one_off.faculty.open_completed", {
              open: faculty.counts.open,
              completed: faculty.counts.completed,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("one_off.faculty.completed")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.completed}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("one_off.faculty.completed_help")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("one_off.faculty.held")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.held}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("one_off.faculty.held_help")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("one_off.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.conversionActive
              ? t("one_off.faculty.conversion_on")
              : t("one_off.faculty.conversion_off")}
          </dd>
        </div>
      </dl>
      {faculty.recent.length ? (
        <ul className="mt-4 space-y-2">
          {faculty.recent.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-line px-4 py-3 text-sm"
            >
              <p className="font-bold text-brand">
                {row.reference || t("one_off.faculty.unassigned")}
                {hideCounterpartyNames
                  ? ""
                  : ` · ${row.counterpartyName ?? t("one_off.faculty.unassigned")}`}
              </p>
              <p className="mt-1 text-muted">
                {row.amountFormatted}
                {row.listedPriceFormatted
                  ? ` · ${t("card.listed_as", { price: row.listedPriceFormatted })}`
                  : ""}
                {` · ${row.status.replaceAll("_", " ")}`}
                {` · ${row.createdAt.slice(0, 10)}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("one_off.faculty.empty")}</p>
      )}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("one_off.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
