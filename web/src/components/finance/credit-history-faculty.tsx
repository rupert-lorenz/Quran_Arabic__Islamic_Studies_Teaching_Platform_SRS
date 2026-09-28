"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getCreditHistoryFaculty } from "@/server/finance/credit-history";

type Faculty = Awaited<ReturnType<typeof getCreditHistoryFaculty>>;

function sourceKey(source: Faculty["recent"][number]["source"]) {
  if (source === "cancellation") {
    return "credit_history.faculty.cancellation" as const;
  }
  if (source === "refund") {
    return "credit_history.faculty.refund" as const;
  }
  return "credit_history.faculty.award" as const;
}

export function CreditHistoryFacultyView({
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
        {t("credit_history.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {t("credit_history.faculty.help")}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("credit_history.faculty.credits")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.totals.creditsFormatted}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("credit_history.faculty.credits_help", {
              count: faculty.counts.credits,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("credit_history.faculty.refunds")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.totals.refundsFormatted}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("credit_history.faculty.refunds_help", {
              count: faculty.counts.refunds,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("credit_history.faculty.pending")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.totals.pendingFormatted}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("credit_history.faculty.pending_help", {
              count: faculty.counts.pending,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("credit_history.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.conversionActive
              ? t("credit_history.faculty.conversion_on")
              : t("credit_history.faculty.conversion_off")}
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
                {t(sourceKey(row.source))}
                {hideCounterpartyNames
                  ? ""
                  : ` · ${row.counterpartyName ?? t("credit_history.faculty.unassigned")}`}
              </p>
              <p className="mt-1 text-muted">
                {row.amountFormatted}
                {row.listedPriceFormatted
                  ? ` · ${t("card.listed_as", { price: row.listedPriceFormatted })}`
                  : ""}
                {` · ${row.status.replaceAll("_", " ")}`}
                {` · ${row.createdAt.slice(0, 10)}`}
                {row.reference ? ` · ${row.reference}` : ""}
              </p>
              {row.notes ? (
                <p className="mt-1 text-sm text-muted">{row.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {t("credit_history.faculty.empty")}
        </p>
      )}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("credit_history.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
