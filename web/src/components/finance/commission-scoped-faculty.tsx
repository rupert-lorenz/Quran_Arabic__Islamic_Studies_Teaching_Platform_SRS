"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getCommissionScopedFaculty } from "@/server/finance/commission-scoped";

type Faculty = Awaited<ReturnType<typeof getCommissionScopedFaculty>>;

function scopeKey(scope: Faculty["recent"][number]["scope"]) {
  if (scope === "country") {
    return "commission_scoped.faculty.country" as const;
  }
  if (scope === "course") {
    return "commission_scoped.faculty.course" as const;
  }
  if (scope === "class") {
    return "commission_scoped.faculty.class" as const;
  }
  return "commission_scoped.faculty.teacher" as const;
}

export function CommissionScopedFacultyView({
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
        {t("commission_scoped.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {faculty.hasFixed
          ? t("commission_scoped.faculty.help_fixed", {
              percent: faculty.percent,
              fixed: faculty.fixedFormatted,
            })
          : t("commission_scoped.faculty.help", { percent: faculty.percent })}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_scoped.faculty.teacher")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.teacher}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("commission_scoped.faculty.teacher_help")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_scoped.faculty.country")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.country}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("commission_scoped.faculty.country_help")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_scoped.faculty.course")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.course}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("commission_scoped.faculty.course_help")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_scoped.faculty.class")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.counts.class}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("commission_scoped.faculty.class_help")}
          </dd>
        </div>
      </dl>
      {faculty.recent.length ? (
        <ul className="mt-4 space-y-2">
          {faculty.recent.map((row) => (
            <li
              key={`${row.scope}-${row.id}`}
              className="rounded-2xl border border-line px-4 py-3 text-sm"
            >
              <p className="font-bold text-brand">
                {t(scopeKey(row.scope))} · {row.label}
                {hideTeacherNames || !row.teacherName
                  ? ""
                  : ` · ${row.teacherName}`}
              </p>
              <p className="mt-1 text-muted">
                {t("commission_scoped.faculty.split_line", {
                  gross: row.grossFormatted,
                  commission: row.commissionFormatted,
                  net: row.netFormatted,
                })}
                {row.listedGrossFormatted
                  ? ` · ${t("card.listed_as", {
                      price: row.listedGrossFormatted,
                    })}`
                  : ""}
                {` · ${row.createdAt.slice(0, 10)}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {t("commission_scoped.faculty.empty")}
        </p>
      )}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("commission_scoped.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
