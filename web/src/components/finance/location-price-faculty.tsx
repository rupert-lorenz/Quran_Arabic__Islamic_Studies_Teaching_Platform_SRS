"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { getLocationPriceFaculty } from "@/server/finance/location-prices";

type Faculty = Awaited<ReturnType<typeof getLocationPriceFaculty>>;

const sourceKeys = {
  cookie: "price.faculty.source.cookie",
  account: "price.faculty.source.account",
  country: "price.faculty.source.country",
  default: "price.faculty.source.default",
} as const;

export function LocationPriceFacultyView({
  faculty,
  manageHref,
  hideTeacherRules = false,
}: {
  faculty: Faculty;
  manageHref?: string | null;
  hideTeacherRules?: boolean;
}) {
  const t = useT();
  const rules = hideTeacherRules
    ? faculty.rules.filter((rule) => rule.scope !== "teacher")
    : faculty.rules;

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("price.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {t("price.faculty.help")}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("price.faculty.market")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.country?.name ?? t("price.faculty.no_country")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("price.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t(sourceKeys[faculty.marketSource])}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("price.faculty.conversion")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.conversionActive
              ? t("price.faculty.conversion_on")
              : t("price.faculty.conversion_off")}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("price.faculty.band")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.marketBand
              ? `${faculty.marketBand.minFormatted}–${faculty.marketBand.maxFormatted}`
              : `${faculty.platformBand.minFormatted}–${faculty.platformBand.maxFormatted}`}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {faculty.countryRuleConfigured
              ? t("price.faculty.band_market")
              : t("price.faculty.band_platform")}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-sm font-semibold text-brand">
        {hideTeacherRules
          ? t("price.faculty.counts_public", {
              country: faculty.counts.country,
              subject: faculty.counts.subject,
            })
          : t("price.faculty.counts", {
              country: faculty.counts.country,
              subject: faculty.counts.subject,
              teacher: faculty.counts.teacher,
            })}
      </p>
      {rules.length ? (
        <ul className="mt-4 space-y-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="rounded-2xl border border-line px-4 py-3 text-sm"
            >
              <p className="font-bold capitalize text-brand">
                {rule.scope} · {rule.label}
              </p>
              <p className="mt-1 text-muted">
                {rule.minFormatted}–{rule.maxFormatted}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("price.faculty.rules_empty")}</p>
      )}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("price.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}

export function MarketPriceNote({ faculty }: { faculty: Faculty }) {
  const t = useT();
  if (!faculty.conversionActive && !faculty.countryRuleConfigured) {
    return null;
  }
  return (
    <p className="rounded-[1.5rem] bg-mint px-4 py-3 text-sm font-semibold text-brand">
      {faculty.conversionActive
        ? t("price.faculty.public_converted", {
            code: faculty.display.code,
          })
        : t("price.faculty.public_band", {
            market: faculty.country?.name ?? faculty.display.code,
          })}
    </p>
  );
}
