"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getSinglePaymentsFaculty } from "@/server/finance/single-payments";

type Faculty = Awaited<ReturnType<typeof getSinglePaymentsFaculty>>;

export function SinglePaymentsFacultyView({
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
        {t("single.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {t("single.faculty.help")}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("single.faculty.payments")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.payments}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("single.faculty.open_completed", {
              open: faculty.counts.open,
              completed: faculty.counts.completed,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("single.faculty.one_off")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.oneOff}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("single.faculty.one_off_help")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("single.faculty.recurring")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.recurring}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("single.faculty.recurring_help")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("single.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.conversionActive
              ? t("single.faculty.conversion_on")
              : t("single.faculty.conversion_off")}
          </dd>
        </div>
      </dl>
      {faculty.counts.trial ? (
        <p className="mt-4 text-sm font-semibold text-brand">
          {t("single.faculty.trial_count", { count: faculty.counts.trial })}
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
                {row.subjectName}
                {hideStudentNames ? "" : ` · ${row.studentName}`}
                {row.trial ? ` · ${t("single.faculty.trial_tag")}` : ""}
                {row.recurring ? ` · ${t("single.faculty.series_tag")}` : ""}
              </p>
              <p className="mt-1 text-muted">
                {row.durationMinutes} {t("booking.minutes")} · {row.amountFormatted}
                {row.listedPriceFormatted
                  ? ` · ${t("card.listed_as", { price: row.listedPriceFormatted })}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("single.faculty.empty")}</p>
      )}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("single.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
