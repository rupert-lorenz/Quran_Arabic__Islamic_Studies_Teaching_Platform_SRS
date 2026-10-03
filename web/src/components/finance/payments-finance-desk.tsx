"use client";

import Link from "next/link";
import { useState } from "react";
import { CurrenciesFacultyView } from "@/components/finance/currencies-faculty";
import { HourlyLessonsFacultyView } from "@/components/finance/hourly-lessons-faculty";
import { LocationPriceFacultyView } from "@/components/finance/location-price-faculty";
import { BlockBookingsFacultyView } from "@/components/finance/block-bookings-faculty";
import { MonthlySubscriptionsFacultyView } from "@/components/finance/monthly-subscriptions-faculty";
import { CoursePaymentsFacultyView } from "@/components/finance/course-payments-faculty";
import { CommissionAutoFacultyView } from "@/components/finance/commission-auto-faculty";
import { CommissionRulesFacultyView } from "@/components/finance/commission-rules-faculty";
import { CommissionScopedFacultyView } from "@/components/finance/commission-scoped-faculty";
import { CommunicationsFacultyView } from "@/components/finance/communications-faculty";
import { NoticeFacultiesView } from "@/components/finance/notice-faculties";
import { SafeguardFacultiesView } from "@/components/quality/safeguard-faculties";
import { CrmFacultiesView } from "@/components/crm/crm-faculties";
import { MobileFacultiesView } from "@/components/mobile/mobile-faculties";
import { InfrastructureFacultiesView } from "@/components/infrastructure/infrastructure-faculties";
import { DocumentationFacultiesView } from "@/components/docs/documentation-faculties";
import { HandoverFacultiesView } from "@/components/handover/handover-faculties";
import { TestingFacultiesView } from "@/components/testing/testing-faculties";
import { SecurityFacultiesView } from "@/components/security/security-faculties";
import { LedgerFacultyView } from "@/components/finance/ledger-faculty";
import { CreditHistoryFacultyView } from "@/components/finance/credit-history-faculty";
import { CustomerWalletFacultyView } from "@/components/finance/customer-wallet-faculty";
import { GroupClassPaymentsFacultyView } from "@/components/finance/group-class-payments-faculty";
import { OneOffPaymentsFacultyView } from "@/components/finance/one-off-payments-faculty";
import { SinglePaymentsFacultyView } from "@/components/finance/single-payments-faculty";
import { AccountsWorkspace } from "@/components/staff/accounts-workspace";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";
import type { UiMessageKey } from "@/lib/i18n";
import type { PaymentsModuleId } from "@/lib/payments-finance";
import type { getPaymentsFinanceDesk } from "@/server/finance/service";

type Desk = Awaited<ReturnType<typeof getPaymentsFinanceDesk>>;

const moduleTitleKeys: Record<PaymentsModuleId, UiMessageKey> = {
  currencies: "pay.module.currencies",
  location_prices: "pay.module.location_prices",
  hourly: "pay.module.hourly",
  single: "pay.module.single",
  blocks: "pay.module.blocks",
  subscriptions: "pay.module.subscriptions",
  one_off: "pay.module.one_off",
  courses: "pay.module.courses",
  groups: "pay.module.groups",
  wallet: "pay.module.wallet",
  credit_history: "pay.module.credit_history",
  commission_auto: "pay.module.commission_auto",
  commission_rules: "pay.module.commission_rules",
  commission_scoped: "pay.module.commission_scoped",
  earnings: "pay.module.earnings",
  earnings_split: "pay.module.earnings_split",
  payouts: "pay.module.payouts",
  payouts_auto: "pay.module.payouts_auto",
  refunds: "pay.module.refunds",
  account_credit: "pay.module.account_credit",
  disputes: "pay.module.disputes",
  promo: "pay.module.promo",
  referral: "pay.module.referral",
};

const moduleHelpKeys: Record<PaymentsModuleId, UiMessageKey> = {
  currencies: "pay.module.help.currencies",
  location_prices: "pay.module.help.location_prices",
  hourly: "pay.module.help.hourly",
  single: "pay.module.help.single",
  blocks: "pay.module.help.blocks",
  subscriptions: "pay.module.help.subscriptions",
  one_off: "pay.module.help.one_off",
  courses: "pay.module.help.courses",
  groups: "pay.module.help.groups",
  wallet: "pay.module.help.wallet",
  credit_history: "pay.module.help.credit_history",
  commission_auto: "pay.module.help.commission_auto",
  commission_rules: "pay.module.help.commission_rules",
  commission_scoped: "pay.module.help.commission_scoped",
  earnings: "pay.module.help.earnings",
  earnings_split: "pay.module.help.earnings_split",
  payouts: "pay.module.help.payouts",
  payouts_auto: "pay.module.help.payouts_auto",
  refunds: "pay.module.help.refunds",
  account_credit: "pay.module.help.account_credit",
  disputes: "pay.module.help.disputes",
  promo: "pay.module.help.promo",
  referral: "pay.module.help.referral",
};

function MoneyList({
  items,
  empty,
}: {
  items: { currencyCode: string; amountLabel: string }[];
  empty: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.currencyCode} className="font-bold text-brand">
          {item.amountLabel}{" "}
          <span className="text-xs font-semibold text-muted">{item.currencyCode}</span>
        </li>
      ))}
    </ul>
  );
}

export function PaymentsFinanceDeskView({ desk }: { desk: Desk }) {
  const t = useT();
  const [earnings, setEarnings] = useState(desk.earnings);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
          {t("pay.architecture.title")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">{t("pay.architecture.help")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl bg-mint px-4 py-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
              {t("pay.adapter.payments")}
            </p>
            <p className="mt-1 font-bold text-brand">
              {desk.adapters.payments.configured
                ? t("pay.adapter.configured")
                : t("pay.adapter.manual")}
            </p>
            <p className="mt-1 text-sm text-muted">{desk.adapters.payments.purpose}</p>
          </article>
          <article className="rounded-2xl bg-mint px-4 py-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
              {t("pay.adapter.payouts")}
            </p>
            <p className="mt-1 font-bold text-brand">
              {desk.adapters.payouts.configured
                ? t("pay.adapter.configured")
                : t("pay.adapter.manual")}
            </p>
            <p className="mt-1 text-sm text-muted">{desk.adapters.payouts.purpose}</p>
          </article>
        </div>
        <p className="mt-4 text-sm font-semibold text-brand">
          {t("pay.commission.summary", {
            percent: desk.commission.percent,
            fixed: desk.commission.fixedLabel,
          })}
        </p>
        {desk.role !== "parent" ? (
          <p className="mt-2 text-sm text-muted">{t("pay.hidden_from_students")}</p>
        ) : null}
      </section>

      <CurrenciesFacultyView
        faculty={desk.currenciesFaculty}
        manageHref={desk.role === "staff" ? "/staff/currencies" : null}
      />
      <LocationPriceFacultyView
        faculty={desk.locationPrices}
        manageHref={desk.role === "staff" ? "/staff/rates" : null}
        hideTeacherRules={desk.role === "parent"}
      />
      <HourlyLessonsFacultyView
        faculty={desk.hourlyLessons}
        manageHref={
          desk.role === "staff"
            ? "/staff/bookings"
            : desk.role === "teacher"
              ? "/teach/bookings"
              : "/family/bookings"
        }
      />
      <SinglePaymentsFacultyView
        faculty={desk.singlePayments}
        manageHref={
          desk.role === "staff"
            ? "/staff/bookings"
            : desk.role === "teacher"
              ? "/teach/bookings"
              : "/family/bookings"
        }
      />
      <BlockBookingsFacultyView
        faculty={desk.blockBookings}
        manageHref={
          desk.role === "staff"
            ? "/staff/bookings"
            : desk.role === "teacher"
              ? "/teach/bookings"
              : "/family/bookings"
        }
      />
      <MonthlySubscriptionsFacultyView
        faculty={desk.monthlySubscriptions}
        manageHref={
          desk.role === "staff"
            ? "/staff/academic"
            : desk.role === "teacher"
              ? "/teach/library"
              : "/family/library"
        }
      />
      <OneOffPaymentsFacultyView
        faculty={desk.oneOffPayments}
        manageHref={
          desk.role === "staff"
            ? "/staff/accounts"
            : desk.role === "teacher"
              ? "/teach/earnings"
              : "/family/wallet"
        }
      />
      <CoursePaymentsFacultyView
        faculty={desk.coursePayments}
        manageHref={
          desk.role === "teacher" ? "/teach/live-courses" : "/live-courses"
        }
      />
      <GroupClassPaymentsFacultyView
        faculty={desk.groupClassPayments}
        manageHref={
          desk.role === "staff"
            ? "/staff/group-classes"
            : desk.role === "teacher"
              ? "/teach/group-lessons"
              : "/group-lessons"
        }
      />
      {desk.role !== "teacher" ? (
        <>
          <CustomerWalletFacultyView
            faculty={desk.customerWallet}
            manageHref={
              desk.role === "staff" ? "/staff/accounts" : "/family/wallet"
            }
          />
          <CreditHistoryFacultyView
            faculty={desk.creditHistory}
            manageHref={
              desk.role === "staff" ? "/staff/accounts" : "/family/wallet"
            }
          />
        </>
      ) : null}
      {desk.role !== "parent" ? (
        <>
          <CommissionAutoFacultyView
            faculty={desk.commissionAuto}
            manageHref={
              desk.role === "staff" ? "/staff/rates" : "/teach/earnings"
            }
            hideTeacherNames={desk.role !== "staff"}
          />
          <CommissionRulesFacultyView
            faculty={desk.commissionRules}
            manageHref={
              desk.role === "staff" ? "/staff/rates" : "/teach/earnings"
            }
          />
          <CommissionScopedFacultyView
            faculty={desk.commissionScoped}
            manageHref={
              desk.role === "staff" ? "/staff/rates" : "/teach/earnings"
            }
            hideTeacherNames={desk.role !== "staff"}
          />
          <LedgerFacultyView
            titleKey="earnings_dashboard.faculty.title"
            helpKey="earnings_dashboard.faculty.help"
            manageKey="earnings_dashboard.faculty.manage"
            emptyKey="earnings_dashboard.faculty.empty"
            manageHref={
              desk.role === "staff" ? "/staff/accounts" : "/teach/earnings"
            }
            tiles={[
              {
                labelKey: "earnings_dashboard.faculty.lines",
                value: desk.earningsBoard.dashboard.lineCount,
              },
              {
                labelKey: "earnings_dashboard.faculty.teachers",
                value: desk.earningsBoard.dashboard.teacherCount,
              },
              {
                labelKey: "earnings_dashboard.faculty.pending",
                value: desk.earningsBoard.dashboard.pendingLabel,
              },
              {
                labelKey: "earnings_dashboard.faculty.available",
                value: desk.earningsBoard.dashboard.availableLabel,
              },
            ]}
            rows={desk.earningsBoard.dashboard.recent.map((row) => ({
              id: `${row.source}-${row.id}`,
              title:
                desk.role === "staff" && row.teacherName
                  ? `${row.source} · ${row.teacherName}`
                  : row.source,
              meta: `${row.grossLabel} · ${row.netLabel} · ${row.status.replaceAll("_", " ")}`,
            }))}
          />
          <LedgerFacultyView
            titleKey="earnings_split.faculty.title"
            helpKey="earnings_split.faculty.help"
            manageKey="earnings_split.faculty.manage"
            emptyKey="earnings_split.faculty.empty"
            hideEmpty
            manageHref={
              desk.role === "staff" ? "/staff/accounts" : "/teach/earnings"
            }
            tiles={[
              {
                labelKey: "earnings_split.faculty.gross",
                value: desk.earningsBoard.split.grossLabel,
              },
              {
                labelKey: "earnings_split.faculty.commission",
                value: desk.earningsBoard.split.commissionLabel,
              },
              {
                labelKey: "earnings_split.faculty.net",
                value: desk.earningsBoard.split.netLabel,
              },
              {
                labelKey: "earnings_split.faculty.pending",
                value: desk.earningsBoard.split.pendingLabel,
              },
              {
                labelKey: "earnings_split.faculty.available",
                value: desk.earningsBoard.split.availableLabel,
              },
              {
                labelKey: "earnings_split.faculty.paid",
                value: desk.earningsBoard.split.paidLabel,
              },
            ]}
            rows={[]}
          />
          <LedgerFacultyView
            titleKey="payouts.faculty.title"
            helpKey="payouts.faculty.help"
            manageKey="payouts.faculty.manage"
            emptyKey="payouts.faculty.empty"
            manageHref={
              desk.role === "staff" ? "/staff/accounts" : "/teach/earnings"
            }
            tiles={[
              {
                labelKey: "payouts.faculty.pending",
                value: desk.settlement.payouts.pending,
              },
              {
                labelKey: "payouts.faculty.completed",
                value: desk.settlement.payouts.completed,
              },
              {
                labelKey: "payouts.faculty.held",
                value: desk.settlement.payouts.held,
              },
              {
                labelKey: "payouts.faculty.rejected",
                value: desk.settlement.payouts.rejected,
              },
            ]}
            rows={desk.settlement.payouts.recent}
          />
          <LedgerFacultyView
            titleKey="payouts_auto.faculty.title"
            helpKey={
              desk.settlement.payoutsAuto.configured
                ? "payouts_auto.faculty.help_on"
                : "payouts_auto.faculty.help"
            }
            manageKey="payouts_auto.faculty.manage"
            emptyKey="payouts_auto.faculty.empty"
            manageHref={desk.role === "staff" ? "/staff/accounts" : null}
            tiles={[
              {
                labelKey: "payouts_auto.faculty.provider",
                value: desk.settlement.payoutsAuto.provider,
              },
              {
                labelKey: "payouts_auto.faculty.queued",
                value: desk.settlement.payoutsAuto.queued,
              },
            ]}
            rows={desk.settlement.payoutsAuto.recent}
          />
          <LedgerFacultyView
              titleKey="disputes.faculty.title"
              helpKey="disputes.faculty.help"
              manageKey="disputes.faculty.manage"
              emptyKey="disputes.faculty.empty"
              manageHref={
                desk.role === "staff" ? "/staff/accounts" : "/teach/earnings"
              }
              tiles={[
                {
                  labelKey: "disputes.faculty.held",
                  value: desk.settlement.disputes.held,
                },
                {
                  labelKey: "disputes.faculty.payments",
                  value: desk.settlement.disputes.payments,
                },
                {
                  labelKey: "disputes.faculty.refunds",
                  value: desk.settlement.disputes.refunds,
                },
                {
                  labelKey: "disputes.faculty.credits",
                  value: desk.settlement.disputes.credits,
                },
              ]}
              rows={desk.settlement.disputes.recent}
            />
        </>
      ) : null}
      {desk.role !== "teacher" ? (
        <>
          <LedgerFacultyView
            titleKey="refunds.faculty.title"
            helpKey="refunds.faculty.help"
            manageKey="refunds.faculty.manage"
            emptyKey="refunds.faculty.empty"
            manageHref={
              desk.role === "staff" ? "/staff/accounts" : "/family/wallet"
            }
            tiles={[
              {
                labelKey: "refunds.faculty.full",
                value: desk.settlement.refunds.full,
              },
              {
                labelKey: "refunds.faculty.partial",
                value: desk.settlement.refunds.partial,
              },
              {
                labelKey: "refunds.faculty.pending",
                value: desk.settlement.refunds.pending,
              },
              {
                labelKey: "refunds.faculty.completed",
                value: desk.settlement.refunds.completed,
              },
            ]}
            rows={desk.settlement.refunds.recent}
          />
          <LedgerFacultyView
            titleKey="account_credit.faculty.title"
            helpKey="account_credit.faculty.help"
            manageKey="account_credit.faculty.manage"
            emptyKey="account_credit.faculty.empty"
            manageHref={
              desk.role === "staff" ? "/staff/accounts" : "/family/wallet"
            }
            tiles={[
              {
                labelKey: "account_credit.faculty.pending",
                value: desk.settlement.credits.pending,
              },
              {
                labelKey: "account_credit.faculty.completed",
                value: desk.settlement.credits.completed,
              },
              {
                labelKey: "account_credit.faculty.rejected",
                value: desk.settlement.credits.rejected,
              },
              {
                labelKey: "account_credit.faculty.total",
                value: desk.settlement.credits.total,
              },
            ]}
            rows={desk.settlement.credits.recent}
          />
        </>
      ) : null}
      <LedgerFacultyView
        titleKey="promo.faculty.title"
        helpKey="promo.faculty.help"
        manageKey="promo.faculty.manage"
        emptyKey="promo.faculty.empty"
        manageHref={desk.role === "staff" ? "/staff/marketing" : null}
        tiles={[
          { labelKey: "promo.faculty.active", value: desk.offers.promo.active },
          { labelKey: "promo.faculty.draft", value: desk.offers.promo.draft },
          { labelKey: "promo.faculty.ended", value: desk.offers.promo.ended },
          { labelKey: "promo.faculty.total", value: desk.offers.promo.total },
        ]}
        rows={desk.offers.promo.recent}
      />
      <LedgerFacultyView
        titleKey="referral.faculty.title"
        helpKey="referral.faculty.help"
        manageKey="referral.faculty.manage"
        emptyKey="referral.faculty.empty"
        manageHref={desk.role === "staff" ? "/staff/marketing" : null}
        tiles={[
          {
            labelKey: "referral.faculty.active",
            value: desk.offers.referral.active,
          },
          {
            labelKey: "referral.faculty.draft",
            value: desk.offers.referral.draft,
          },
          {
            labelKey: "referral.faculty.ended",
            value: desk.offers.referral.ended,
          },
          {
            labelKey: "referral.faculty.total",
            value: desk.offers.referral.total,
          },
        ]}
        rows={desk.offers.referral.recent}
      />
      <CommunicationsFacultyView faculty={desk.communications} />
      <NoticeFacultiesView notices={desk.notices} role={desk.role} />
      <SafeguardFacultiesView faculties={desk.safeguard} />
      <CrmFacultiesView faculties={desk.crm} />
      <MobileFacultiesView faculties={desk.mobile} />
      <SecurityFacultiesView faculties={desk.security} />
      <InfrastructureFacultiesView faculties={desk.infrastructure} />
      <TestingFacultiesView faculties={desk.testing} />
      {"documentation" in desk ? (
        <DocumentationFacultiesView faculties={desk.documentation} />
      ) : null}
      {"handover" in desk ? <HandoverFacultiesView faculties={desk.handover} /> : null}

      <section>
        <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
          {t("pay.modules.title")}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {desk.modules.map((item) => (
            <article
              key={item.id}
              className="rounded-[1.5rem] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading text-base font-bold tracking-tight text-brand">
                  {t(moduleTitleKeys[item.id])}
                </h3>
                <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-extrabold text-brand">
                  {item.live ? t("pay.live") : t("pay.planned")}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">
                {t(moduleHelpKeys[item.id])}
              </p>
              {item.href ? (
                <Link
                  href={item.href}
                  className="mt-3 inline-block text-sm font-bold text-brand-accent underline"
                >
                  {t("pay.open")}
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {desk.role === "staff" && desk.workspace ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            {t("pay.register.title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("pay.register.help")}</p>
          <div className="mt-6">
            <AccountsWorkspace
              initial={desk.workspace}
              canRefund={desk.canRefund}
              canPayout={desk.canPayout}
              canReport={desk.canReport}
            />
          </div>
          <div className="mt-8">
            <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
              {t("pay.disputes.title")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">{t("pay.disputes.help")}</p>
            <ul className="mt-4 space-y-2">
              {desk.disputes?.length ? (
                desk.disputes.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl bg-gold px-4 py-3 text-sm font-semibold text-brand"
                  >
                    {item.kind} · {item.amountLabel} ·{" "}
                    {item.counterpartyName ?? item.counterpartyEmail ?? "—"}
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted">{t("pay.disputes.empty")}</li>
              )}
            </ul>
          </div>
        </section>
      ) : null}

      {desk.wallet ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            {t("pay.wallet.title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("pay.wallet.help")}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-mint px-4 py-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
                {t("pay.wallet.available")}
              </p>
              <div className="mt-2">
                <MoneyList items={desk.wallet.available} empty={t("pay.wallet.empty")} />
              </div>
            </div>
            <div className="rounded-2xl bg-mint px-4 py-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
                {t("pay.wallet.pending")}
              </p>
              <div className="mt-2">
                <MoneyList items={desk.wallet.pending} empty={t("pay.wallet.empty")} />
              </div>
            </div>
            <div className="rounded-2xl bg-mint px-4 py-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
                {t("pay.wallet.refunded")}
              </p>
              <div className="mt-2">
                <MoneyList items={desk.wallet.refunded} empty={t("pay.wallet.empty")} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {desk.familyCharges ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            {t("pay.family.charges")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("pay.family.charges_help")}</p>
          <ul className="mt-4 space-y-2">
            {desk.familyCharges.charges.length ? (
              desk.familyCharges.charges.map((item) => (
                <li
                  key={`${item.source}-${item.id}`}
                  className="rounded-2xl border border-line px-4 py-3 text-sm"
                >
                  <p className="font-bold capitalize text-brand">
                    {item.source} · {item.amountLabel}
                  </p>
                  <p className="mt-1 text-muted">{item.status.replaceAll("_", " ")}</p>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted">{t("pay.family.charges_empty")}</li>
            )}
          </ul>
        </section>
      ) : null}

      {earnings ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            {t("pay.earnings.title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("pay.earnings.help")}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(
              [
                ["pay.earnings.gross", earnings.gross],
                ["pay.earnings.commission", earnings.commission],
                ["pay.earnings.net", earnings.net],
                ["pay.earnings.pending", earnings.pending],
                ["pay.earnings.available", earnings.available],
                ["pay.earnings.paid", earnings.paid],
              ] as const
            ).map(([labelKey, items]) => (
              <div key={labelKey} className="rounded-2xl bg-mint px-4 py-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
                  {t(labelKey)}
                </p>
                <div className="mt-2">
                  <MoneyList items={items} empty={t("pay.wallet.empty")} />
                </div>
              </div>
            ))}
          </div>

          {desk.canPayout ? (
            <form
              className="mt-8 grid gap-3 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const formEl = event.currentTarget;
                const form = new FormData(formEl);
                setPending(true);
                setError("");
                setMessage("");
                try {
                  const next = await postJson<Desk>("/api/v1/finance/payouts", {
                    amount: String(form.get("amount") ?? ""),
                    currencyCode: String(form.get("currencyCode") ?? ""),
                    notes: String(form.get("notes") ?? ""),
                  });
                  formEl.reset();
                  setEarnings(next.earnings);
                  setMessage(t("pay.payout.requested"));
                } catch (err) {
                  setError(err instanceof Error ? err.message : t("pay.payout.failed"));
                } finally {
                  setPending(false);
                }
              }}
            >
              <h3 className="font-heading text-lg font-bold tracking-tight text-brand sm:col-span-2">
                {t("pay.payout.title")}
              </h3>
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-brand">
                  {t("pay.payout.amount")}
                </span>
                <input name="amount" required className={fieldClass} inputMode="decimal" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-brand">
                  {t("pay.payout.currency")}
                </span>
                <select
                  name="currencyCode"
                  className={fieldClass}
                  defaultValue={desk.currencies[0]?.code}
                >
                  {desk.currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} · {currency.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-bold text-brand">
                  {t("pay.payout.notes")}
                </span>
                <input name="notes" className={fieldClass} />
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? t("pay.payout.saving") : t("pay.payout.submit")}
                </Button>
              </div>
              {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
              {message ? <p className="text-sm font-semibold text-brand">{message}</p> : null}
            </form>
          ) : null}

          <h3 className="font-heading mt-8 text-lg font-bold tracking-tight text-brand">
            {t("pay.earnings.lines")}
          </h3>
          <ul className="mt-3 space-y-2">
            {earnings.lines.length ? (
              earnings.lines.map((item) => (
                <li
                  key={`${item.source}-${item.id}`}
                  className="rounded-2xl border border-line px-4 py-3 text-sm"
                >
                  <p className="font-bold capitalize text-brand">
                    {item.source} · {t("pay.earnings.net")} {item.netLabel}
                  </p>
                  <p className="mt-1 text-muted">
                    {item.amountLabel} · {item.status.replaceAll("_", " ")}
                    {item.pending ? ` · ${t("pay.earnings.pending")}` : ""}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted">{t("pay.earnings.empty")}</li>
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
