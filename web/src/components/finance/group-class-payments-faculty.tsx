"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getGroupClassPaymentsFaculty } from "@/server/finance/group-class-payments";

type Faculty = Awaited<ReturnType<typeof getGroupClassPaymentsFaculty>>;

export function GroupClassPaymentsFacultyView({
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
        {t("groups.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {t("groups.faculty.help")}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("groups.faculty.payments")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.payments}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("groups.faculty.open_completed", {
              open: faculty.counts.open,
              completed: faculty.counts.completed,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("groups.faculty.classes")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.classes}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("groups.faculty.classes_help", { series: faculty.counts.series })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("groups.faculty.cancelled")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.cancelled}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("groups.faculty.cancelled_help", {
              waitlisted: faculty.counts.waitlisted,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("groups.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.conversionActive
              ? t("groups.faculty.conversion_on")
              : t("groups.faculty.conversion_off")}
          </dd>
        </div>
      </dl>
      {faculty.counts.complimentary ? (
        <p className="mt-4 text-sm font-semibold text-brand">
          {t("groups.faculty.complimentary_count", {
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
                {row.title}
                {hideStudentNames ? "" : ` · ${row.studentName}`}
                {row.series ? ` · ${t("groups.faculty.series_tag")}` : ""}
                {row.complimentary ? ` · ${t("groups.faculty.complimentary")}` : ""}
              </p>
              <p className="mt-1 text-muted">
                {row.durationMinutes} {t("booking.minutes")}
                {` · ${row.amountFormatted ?? t("groups.faculty.complimentary")}`}
                {row.listedPriceFormatted
                  ? ` · ${t("card.listed_as", { price: row.listedPriceFormatted })}`
                  : ""}
                {` · ${row.status.replaceAll("_", " ")}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("groups.faculty.empty")}</p>
      )}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("groups.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
