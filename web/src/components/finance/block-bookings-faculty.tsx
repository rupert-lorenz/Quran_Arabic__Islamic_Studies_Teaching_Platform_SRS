"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getBlockBookingsFaculty } from "@/server/finance/block-bookings";

type Faculty = Awaited<ReturnType<typeof getBlockBookingsFaculty>>;

export function BlockBookingsFacultyView({
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
        {t("blocks.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {t("blocks.faculty.help")}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("blocks.faculty.packages")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.packages}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("blocks.faculty.open_completed", {
              active: faculty.counts.active,
              completed: faculty.counts.completed,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("blocks.faculty.sittings")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.sittings}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("blocks.faculty.sittings_help", {
              remaining: faculty.counts.remaining,
              done: faculty.counts.done,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("blocks.faculty.sizes")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.counts.four + faculty.counts.eight + faculty.counts.twelve}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("blocks.faculty.sizes_help", {
              four: faculty.counts.four,
              eight: faculty.counts.eight,
              twelve: faculty.counts.twelve,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("blocks.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.conversionActive
              ? t("blocks.faculty.conversion_on")
              : t("blocks.faculty.conversion_off")}
          </dd>
        </div>
      </dl>
      {faculty.counts.cancelled ? (
        <p className="mt-4 text-sm font-semibold text-brand">
          {t("blocks.faculty.cancelled", { count: faculty.counts.cancelled })}
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
                {` · ${t("blocks.faculty.discount", {
                  percent: row.discountPercent,
                })}`}
              </p>
              <p className="mt-1 text-muted">
                {t("blocks.faculty.remaining", {
                  remaining: row.remaining,
                  total: row.lessonCount,
                })}
                {` · ${row.amountFormatted}`}
                {row.listedPriceFormatted
                  ? ` · ${t("card.listed_as", { price: row.listedPriceFormatted })}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("blocks.faculty.empty")}</p>
      )}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("blocks.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
