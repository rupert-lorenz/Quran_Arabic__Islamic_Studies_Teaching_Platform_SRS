"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getCommissionAutoFaculty } from "@/server/finance/commission-auto";

type Faculty = Awaited<ReturnType<typeof getCommissionAutoFaculty>>;

function sourceKey(source: Faculty["recent"][number]["source"]) {
  if (source === "block") {
    return "commission_auto.faculty.block" as const;
  }
  if (source === "group") {
    return "commission_auto.faculty.group" as const;
  }
  if (source === "course") {
    return "commission_auto.faculty.course" as const;
  }
  return "commission_auto.faculty.hourly" as const;
}

export function CommissionAutoFacultyView({
  faculty,
  manageHref,
  hideTeacherNames = false,
}: {
  faculty: Faculty;
  manageHref?: string | null;
  hideTeacherNames?: boolean;
}) {
  const t = useT();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("commission_auto.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {faculty.hasFixed
          ? t("commission_auto.faculty.help_fixed", {
              percent: faculty.percent,
              fixed: faculty.fixedFormatted,
            })
          : t("commission_auto.faculty.help", { percent: faculty.percent })}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_auto.faculty.gross")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.totals.grossFormatted}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("commission_auto.faculty.gross_help", {
              count: faculty.counts.splits,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_auto.faculty.commission")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.totals.commissionFormatted}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.hasFixed
              ? t("commission_auto.faculty.commission_help_fixed", {
                  percent: faculty.percent,
                  fixed: faculty.fixedFormatted,
                })
              : t("commission_auto.faculty.commission_help", {
                  percent: faculty.percent,
                })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_auto.faculty.net")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.totals.netFormatted}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("commission_auto.faculty.net_help")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_auto.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.conversionActive
              ? t("commission_auto.faculty.conversion_on")
              : t("commission_auto.faculty.conversion_off")}
          </dd>
        </div>
      </dl>
      {faculty.recent.length ? (
        <ul className="mt-4 space-y-2">
          {faculty.recent.map((row) => (
            <li
              key={`${row.source}-${row.id}`}
              className="rounded-2xl border border-line px-4 py-3 text-sm"
            >
              <p className="font-bold text-brand">
                {t(sourceKey(row.source))}
                {hideTeacherNames
                  ? ""
                  : ` · ${row.teacherName ?? t("commission_auto.faculty.unassigned")}`}
              </p>
              <p className="mt-1 text-muted">
                {t("commission_auto.faculty.split_line", {
                  gross: row.grossFormatted,
                  commission: row.commissionFormatted,
                  net: row.netFormatted,
                })}
                {row.listedGrossFormatted
                  ? ` · ${t("card.listed_as", { price: row.listedGrossFormatted })}`
                  : ""}
                {` · ${row.status.replaceAll("_", " ")}`}
                {` · ${row.createdAt.slice(0, 10)}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {t("commission_auto.faculty.empty")}
        </p>
      )}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("commission_auto.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
