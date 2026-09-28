"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getMonthlySubscriptionsFaculty } from "@/server/finance/monthly-subscriptions";

type Faculty = Awaited<ReturnType<typeof getMonthlySubscriptionsFaculty>>;

export function MonthlySubscriptionsFacultyView({
  faculty,
  manageHref,
  hideStudentNames = false,
}: {
  faculty: Faculty;
  manageHref?: string | null;
  hideStudentNames?: boolean;
}) {
  const t = useT();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("subscriptions.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {t("subscriptions.faculty.help")}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("subscriptions.faculty.seats")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.seats}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("subscriptions.faculty.ended", {
              ended: faculty.counts.ended,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("subscriptions.faculty.monthly")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.monthly}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("subscriptions.faculty.monthly_help")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("subscriptions.faculty.plans")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.plans}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("subscriptions.faculty.plans_help", {
              priced: faculty.counts.priced,
              monthly: faculty.counts.monthlyPlans,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("subscriptions.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.conversionActive
              ? t("subscriptions.faculty.conversion_on")
              : t("subscriptions.faculty.conversion_off")}
          </dd>
        </div>
      </dl>
      {faculty.counts.complimentary ? (
        <p className="mt-4 text-sm font-semibold text-brand">
          {t("subscriptions.faculty.complimentary_count", {
            count: faculty.counts.complimentary,
          })}
        </p>
      ) : null}
      {faculty.recent.length ? (
        <ul className="mt-4 space-y-2">
          {faculty.recent.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-line px-4 py-3 text-sm"
            >
              <p className="font-bold text-brand">
                {row.planName}
                {hideStudentNames ? "" : ` · ${row.studentName}`}
                {row.monthly ? ` · ${t("subscriptions.faculty.monthly_tag")}` : ""}
                {row.complimentary
                  ? ` · ${t("subscriptions.faculty.complimentary")}`
                  : ""}
              </p>
              <p className="mt-1 text-muted">
                {row.amountFormatted ?? t("subscriptions.faculty.complimentary")}
                {row.listedPriceFormatted
                  ? ` · ${t("card.listed_as", { price: row.listedPriceFormatted })}`
                  : ""}
                {row.expiresAt
                  ? ` · ${row.expiresAt.slice(0, 10)}`
                  : ` · ${t("library.subscription.open_ended")}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("subscriptions.faculty.empty")}</p>
      )}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("subscriptions.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
