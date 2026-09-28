"use client";

import Link from "next/link";
import { CurrencySwitcher } from "@/components/money/currency-switcher";
import { useT } from "@/components/i18n/i18n-provider";
import type { getCurrenciesFaculty } from "@/server/money/currency";

type Faculty = Awaited<ReturnType<typeof getCurrenciesFaculty>>;

export function CurrenciesFacultyView({
  faculty,
  manageHref,
}: {
  faculty: Faculty;
  manageHref?: string | null;
}) {
  const t = useT();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            {t("currency.faculty.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {t("currency.faculty.help")}
          </p>
        </div>
        <CurrencySwitcher
          currencies={faculty.enabled}
          current={faculty.display.code}
          label={t("currency.label")}
        />
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("currency.faculty.display")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.display.symbol} {faculty.display.code}
          </dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("currency.faculty.settlement")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{t("currency.faculty.listed")}</dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("currency.faculty.available")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.enabledCount} / {faculty.catalogueCount}
          </dd>
        </div>
      </dl>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {faculty.catalogue
          .filter((item) => item.isEnabled)
          .map((item) => (
            <li
              key={item.code}
              className="rounded-2xl border border-line px-4 py-3 text-sm"
            >
              <p className="font-bold text-brand">
                {item.symbol} {item.code}
                {item.isDefault ? (
                  <span className="ms-2 text-xs font-extrabold uppercase text-brand-accent">
                    {t("currency.faculty.default")}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-muted">{item.name}</p>
              <p className="mt-1 text-xs font-semibold text-muted">
                {item.hasRate
                  ? t("currency.faculty.has_rate")
                  : t("currency.faculty.missing_rate")}
              </p>
            </li>
          ))}
      </ul>
      {faculty.missingRates.length ? (
        <p className="mt-4 text-sm font-semibold text-brand">
          {t("currency.faculty.missing_help", {
            codes: faculty.missingRates.map((item) => item.code).join(", "),
          })}
        </p>
      ) : null}
      {manageHref ? (
        <Link
          href={manageHref}
          className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
        >
          {t("currency.faculty.manage")}
        </Link>
      ) : null}
    </section>
  );
}
