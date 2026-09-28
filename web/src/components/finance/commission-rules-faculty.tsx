"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getCommissionRulesFaculty } from "@/server/finance/commission-rules";

type Faculty = Awaited<ReturnType<typeof getCommissionRulesFaculty>>;

export function CommissionRulesFacultyView({
  faculty,
  manageHref,
}: {
  faculty: Faculty;
  manageHref?: string | null;
}) {
  const t = useT();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("commission_rules.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {t("commission_rules.faculty.help", { max: faculty.maxPercent })}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_rules.faculty.percent")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.percent}%</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("commission_rules.faculty.percent_help", {
              max: faculty.maxPercent,
            })}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_rules.faculty.fixed")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.fixedFormatted}</dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.hasFixed
              ? faculty.listedFixedFormatted &&
                faculty.listedFixedFormatted !== faculty.fixedFormatted
                ? t("commission_rules.faculty.fixed_help_listed", {
                    amount: faculty.listedFixedFormatted,
                  })
                : t("commission_rules.faculty.fixed_help_on")
              : t("commission_rules.faculty.fixed_help_off")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_rules.faculty.example")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.example.commissionFormatted}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("commission_rules.faculty.split_line", {
              gross: faculty.example.grossFormatted,
              commission: faculty.example.commissionFormatted,
              net: faculty.example.netFormatted,
            })}
            {faculty.example.listedGrossFormatted
              ? ` · ${t("card.listed_as", {
                  price: faculty.example.listedGrossFormatted,
                })}`
              : ""}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("commission_rules.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.conversionActive
              ? t("commission_rules.faculty.conversion_on")
              : t("commission_rules.faculty.conversion_off")}
          </dd>
        </div>
      </dl>
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("commission_rules.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
