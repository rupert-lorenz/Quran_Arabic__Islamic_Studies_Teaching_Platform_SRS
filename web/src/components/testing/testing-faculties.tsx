"use client";

import { LedgerFacultyView } from "@/components/finance/ledger-faculty";
import { UatPasswordForms } from "@/components/testing/uat-password-forms";
import { useT } from "@/components/i18n/i18n-provider";
import type { UiMessageKey } from "@/lib/i18n";
import type { getTestingFaculties } from "@/server/testing/faculties";

type Faculties = Awaited<ReturnType<typeof getTestingFaculties>>;

export function TestingFacultiesView({
  faculties,
  showIdentity = false,
  showPasswordForm = false,
}: {
  faculties: Faculties;
  showIdentity?: boolean;
  showPasswordForm?: boolean;
}) {
  const t = useT();
  const recorded = t("tq.notRecorded");
  const off = t("in.off");

  return (
    <div className="space-y-8">
      <LedgerFacultyView
        titleKey="tq.functional.title"
        helpKey="tq.functional.help"
        tiles={[{ labelKey: "tq.functional.suite", value: recorded }]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.integration.title"
        helpKey="tq.integration.help"
        tiles={[
          { labelKey: "tq.integration.connected", value: faculties.integration.connected },
          { labelKey: "tq.integration.listed", value: faculties.integration.listed },
        ]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.payments.title"
        helpKey="tq.payments.help"
        tiles={[
          {
            labelKey: "tq.payments.gateway",
            value: faculties.payments.gateway ? t("in.on") : off,
          },
          { labelKey: "tq.payments.cards", value: faculties.payments.cardNumbersStored ? 1 : 0 },
        ]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.classroom.title"
        helpKey="tq.classroom.help"
        tiles={[
          { labelKey: "tq.classroom.rooms", value: faculties.classroom.rooms },
          {
            labelKey: "tq.classroom.external",
            value: faculties.classroom.external ? t("in.on") : off,
          },
        ]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.load.title"
        helpKey="tq.load.help"
        tiles={[{ labelKey: "tq.load.runs", value: faculties.load.runs }]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.security.title"
        helpKey="tq.security.help"
        tiles={[
          { labelKey: "tq.security.public", value: faculties.security.publicSensitive },
          {
            labelKey: "tq.security.https",
            value: faculties.security.https ? t("in.on") : off,
          },
          { labelKey: "tq.security.scan", value: recorded },
        ]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.mobile.title"
        helpKey="tq.mobile.help"
        tiles={[{ labelKey: "tq.mobile.passes", value: faculties.mobile.devicePasses }]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/mobile"
        manageKey="tq.mobile.apps"
      />
      <LedgerFacultyView
        titleKey="tq.browser.title"
        helpKey="tq.browser.help"
        tiles={[{ labelKey: "tq.browser.required", value: 5 }]}
        rows={[
          { id: "chrome", title: t("tq.browser.chrome"), meta: t("tq.browser.checked") },
          { id: "safari", title: t("tq.browser.safari"), meta: t("tq.browser.notOpened") },
          { id: "firefox", title: t("tq.browser.firefox"), meta: t("tq.browser.notOpened") },
          { id: "edge", title: t("tq.browser.edge"), meta: t("tq.browser.notOpened") },
          { id: "mobile", title: t("tq.browser.mobile"), meta: t("tq.browser.notOpened") },
        ]}
        emptyKey="tq.empty"
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      {(
        [
          ["chrome", "tq.browser.chrome.help", "tq.browser.checked"],
          ["safari", "tq.browser.safari.help", "tq.browser.notOpened"],
          ["firefox", "tq.browser.firefox.help", "tq.browser.notOpened"],
          ["edge", "tq.browser.edge.help", "tq.browser.notOpened"],
          ["mobile", "tq.browser.mobile.help", "tq.browser.notOpened"],
        ] as const
      ).map(([id, helpKey, stateKey]) => (
        <LedgerFacultyView
          key={id}
          titleKey={`tq.browser.${id}` as UiMessageKey}
          helpKey={helpKey}
          tiles={[{ labelKey: "tq.browser.state", value: t(stateKey) }]}
          rows={[]}
          emptyKey="tq.empty"
          hideEmpty
          manageHref="/staff/testing"
          manageKey="tq.open"
        />
      ))}
      <LedgerFacultyView
        titleKey="tq.timezone.title"
        helpKey="tq.timezone.help"
        tiles={[
          { labelKey: "tq.timezone.zones", value: faculties.timezone.zones },
          { labelKey: "tq.timezone.accounts", value: faculties.timezone.withZone },
        ]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.currency.title"
        helpKey="tq.currency.help"
        tiles={[{ labelKey: "tq.currency.enabled", value: faculties.currency.enabled }]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.arabic.title"
        helpKey="tq.arabic.help"
        tiles={[
          {
            labelKey: "tq.arabic.locale",
            value: faculties.arabic.enabled ? t("in.on") : off,
          },
          {
            labelKey: "tq.arabic.direction",
            value: faculties.arabic.rtl ? t("tq.arabic.rtl") : t("tq.arabic.ltr"),
          },
        ]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.ai.title"
        helpKey="tq.ai.help"
        tiles={[
          { labelKey: "tq.ai.external", value: faculties.ai.external ? t("in.on") : off },
          { labelKey: "tq.ai.evaluations", value: faculties.ai.evaluations },
        ]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.permissions.title"
        helpKey="tq.permissions.help"
        tiles={[{ labelKey: "tq.permissions.catalog", value: faculties.permissions.catalog }]}
        rows={faculties.permissions.rows.map((row) => ({
          id: row.id,
          title: t(`tq.role.${row.id}` as UiMessageKey),
          meta: row.full
            ? t("tq.permissions.full")
            : row.marketplace
              ? t("tq.permissions.marketplace")
              : t("tq.permissions.count", { count: row.count }),
        }))}
        emptyKey="tq.empty"
        manageHref="/staff/roles"
        manageKey="tq.permissions.roles"
      />
      <LedgerFacultyView
        titleKey="tq.performance.title"
        helpKey="tq.performance.help"
        tiles={[
          { labelKey: "tq.performance.redis", value: faculties.performance.redis ? t("in.on") : off },
          { labelKey: "tq.performance.runs", value: faculties.performance.runs },
        ]}
        rows={[]}
        emptyKey="tq.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.qa.title"
        helpKey="tq.qa.help"
        tiles={[{ labelKey: "tq.qa.signoff", value: recorded }]}
        rows={[
          { id: "tls", title: t("tq.qa.tls"), meta: faculties.security.https ? t("in.on") : off },
          { id: "mail", title: t("tq.qa.mail"), meta: t("tq.qa.mail.meta") },
          { id: "gateway", title: t("tq.qa.gateway"), meta: faculties.payments.gateway ? t("in.on") : off },
          { id: "sms", title: t("tq.qa.sms"), meta: off },
          { id: "whatsapp", title: t("tq.qa.whatsapp"), meta: t("tq.qa.whatsapp.meta") },
          { id: "storage", title: t("tq.qa.storage"), meta: faculties.qa.storage ? t("in.on") : off },
          { id: "push", title: t("tq.qa.push"), meta: off },
        ]}
        emptyKey="tq.empty"
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="tq.uat.title"
        helpKey="tq.uat.help"
        tiles={[
          {
            labelKey: "tq.uat.ready",
            value: faculties.uat.accounts.filter((account) => account.ready).length,
          },
          { labelKey: "tq.uat.required", value: faculties.uat.accounts.length },
        ]}
        rows={faculties.uat.accounts.map((account) => ({
          id: account.id,
          title: t(`tq.role.${account.id}` as UiMessageKey),
          meta: account.ready ? t("tq.uat.ready.yes") : t("tq.uat.missing"),
        }))}
        emptyKey="tq.empty"
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      {faculties.uat.accounts.map((account) => (
        <LedgerFacultyView
          key={account.id}
          titleKey={`tq.uat.card.${account.id}` as UiMessageKey}
          helpKey={account.staff ? "tq.uat.card.staff" : "tq.uat.card.family"}
          tiles={[
            {
              labelKey: "tq.uat.dedicated",
              value: account.ready ? t("in.yes") : t("tq.uat.missing"),
            },
            ...(account.staff
              ? [
                  {
                    labelKey: "tq.uat.twoFactor" as const,
                    value: t("tq.uat.twoFactor.required"),
                  },
                ]
              : []),
          ]}
          rows={
            showIdentity && account.ready
              ? [{ id: account.id, title: account.email, meta: account.displayName }]
              : []
          }
          emptyKey="tq.empty"
          hideEmpty
          manageHref={account.home}
          manageKey="tq.uat.openHome"
        />
      ))}
      {showPasswordForm ? <UatPasswordForms accounts={faculties.uat.accounts} /> : null}
      <LedgerFacultyView
        titleKey="tq.workflow.title"
        helpKey="tq.workflow.help"
        tiles={[
          { labelKey: "tq.workflow.roles", value: faculties.uat.accounts.length },
          { labelKey: "tq.workflow.signed", value: recorded },
        ]}
        rows={faculties.uat.accounts.map((account) => ({
          id: account.id,
          title: t(`tq.role.${account.id}` as UiMessageKey),
          meta: `${account.workflow} · ${t("tq.workflow.unsigned")}`,
        }))}
        emptyKey="tq.empty"
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
    </div>
  );
}
