"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getCustomerWalletFaculty } from "@/server/finance/customer-wallet";

type Faculty = Awaited<ReturnType<typeof getCustomerWalletFaculty>>;

export function CustomerWalletFacultyView({
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
        {t("wallet.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {t("wallet.faculty.help")}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("wallet.faculty.available")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.totals.availableFormatted}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("wallet.faculty.available_help", {
              count: faculty.counts.available,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("wallet.faculty.pending")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.totals.pendingFormatted}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("wallet.faculty.pending_help", {
              count: faculty.counts.pending,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("wallet.faculty.held")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.totals.heldFormatted}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("wallet.faculty.held_help", { count: faculty.counts.held })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("wallet.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.conversionActive
              ? t("wallet.faculty.conversion_on")
              : t("wallet.faculty.conversion_off")}
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
                {t(
                  row.source === "cancellation"
                    ? "wallet.faculty.cancellation"
                    : "wallet.faculty.award",
                )}
                {hideCounterpartyNames
                  ? ""
                  : ` · ${row.counterpartyName ?? t("wallet.faculty.unassigned")}`}
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
        <p className="mt-4 text-sm text-muted">{t("wallet.faculty.empty")}</p>
      )}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("wallet.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
