"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getHourlyLessonsFaculty } from "@/server/finance/hourly-lessons";

type Faculty = Awaited<ReturnType<typeof getHourlyLessonsFaculty>>;

export function HourlyLessonsFacultyView({
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
        {t("hourly.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {t("hourly.faculty.help", {
          minutes: faculty.defaultDurationMinutes,
          percent: faculty.trialPricePercent,
        })}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("hourly.faculty.sittings")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.sittings}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("hourly.faculty.open_completed", {
              open: faculty.counts.open,
              completed: faculty.counts.completed,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("hourly.faculty.single")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.single}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("hourly.faculty.packaged_note", {
              count: faculty.counts.packaged,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("hourly.faculty.trial")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.trial}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("hourly.faculty.trial_rate", {
              percent: faculty.trialPricePercent,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("hourly.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.conversionActive
              ? t("hourly.faculty.conversion_on")
              : t("hourly.faculty.conversion_off")}
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
                {row.subjectName}
                {hideStudentNames ? "" : ` · ${row.studentName}`}
                {row.packaged ? ` · ${t("hourly.faculty.in_block")}` : ""}
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
        <p className="mt-4 text-sm text-muted">{t("hourly.faculty.empty")}</p>
      )}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("hourly.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
