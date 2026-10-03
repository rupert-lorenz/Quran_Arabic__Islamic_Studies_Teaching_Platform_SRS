"use client";

import { LedgerFacultyView } from "@/components/finance/ledger-faculty";
import { useT } from "@/components/i18n/i18n-provider";
import type { UiMessageKey } from "@/lib/i18n";
import type { HandoverFaculties } from "@/server/handover/faculties";

export function HandoverFacultiesView({ faculties }: { faculties: HandoverFaculties }) {
  const t = useT();
  const on = t("in.on");
  const off = t("in.off");
  const met = t("ho.met");
  const gap = t("ho.gap");
  const present = t("ho.present");
  const absent = t("ho.absent");

  return (
    <div className="space-y-8">
      <LedgerFacultyView
        titleKey="ho.overview.title"
        helpKey="ho.overview.help"
        tiles={[{ labelKey: "ho.overview.records", value: 19 }]}
        rows={[
          { id: "deployment", title: t("ho.deployment.title"), meta: faculties.deployment.env },
          {
            id: "production",
            title: t("ho.production.title"),
            meta: t("ho.production.score", {
              met: faculties.production.met,
              required: faculties.production.required,
            }),
          },
          { id: "source", title: t("ho.source.title"), meta: t("ho.source.meta") },
          {
            id: "repository",
            title: t("ho.repository.title"),
            meta: faculties.repository.remote ? t("ho.repository.remote") : t("ho.repository.none"),
          },
          {
            id: "database",
            title: t("ho.database.title"),
            meta: faculties.database.connected ? t("ho.database.connected") : gap,
          },
          { id: "cloud", title: t("ho.cloud.title"), meta: String(faculties.cloud.length) },
          {
            id: "integrations",
            title: t("ho.integrations.title"),
            meta: t("ho.integrations.score", {
              connected: faculties.integrations.connected,
              listed: faculties.integrations.listed,
            }),
          },
          { id: "accounts", title: t("ho.accounts.title"), meta: String(faculties.accounts.roles.length) },
          { id: "design", title: t("ho.design.title"), meta: faculties.design.logo ? present : absent },
          { id: "documentation", title: t("ho.documentation.title"), meta: t("dc.nav") },
          { id: "configuration", title: t("ho.configuration.title"), meta: faculties.configuration.env },
          {
            id: "credentials",
            title: t("ho.credentials.title"),
            meta: t("ho.credentials.score", {
              held: faculties.credentials.held,
              listed: faculties.credentials.listed,
            }),
          },
          {
            id: "ownership",
            title: t("ho.ownership.title"),
            meta: faculties.ownership.recorded ? met : t("ho.ownership.no"),
          },
          {
            id: "infrastructure",
            title: t("ho.infrastructure.title"),
            meta: faculties.infrastructure.clear ? met : gap,
          },
          {
            id: "finalTesting",
            title: t("ho.finalTesting.title"),
            meta: faculties.finalTesting.signedOff ? met : t("tq.workflow.unsigned"),
          },
          {
            id: "fixes",
            title: t("ho.fixes.title"),
            meta: faculties.fixes.signedOff ? met : t("tq.workflow.unsigned"),
          },
          {
            id: "approval",
            title: t("ho.approval.title"),
            meta: faculties.approval.recorded ? met : t("ho.approval.no"),
          },
          {
            id: "commercial",
            title: t("ho.commercial.title"),
            meta: t("ho.commercial.score", {
              met: faculties.commercial.met,
              required: faculties.commercial.required,
            }),
          },
        ]}
        emptyKey="ho.empty"
        manageHref="/staff/handover"
        manageKey="ho.open.page"
      />
      <LedgerFacultyView
        titleKey="ho.deployment.title"
        helpKey="ho.deployment.help"
        tiles={[
          { labelKey: "ho.deployment.env", value: faculties.deployment.env },
          { labelKey: "ho.deployment.https", value: faculties.deployment.https ? on : off },
          {
            labelKey: "ho.deployment.push",
            value: faculties.deployment.dbPush ? t("ho.deployment.push.on") : t("ho.deployment.push.off"),
          },
        ]}
        rows={[]}
        emptyKey="ho.empty"
        hideEmpty
        manageHref="/staff/handover"
        manageKey="ho.open.page"
      />
      <LedgerFacultyView
        titleKey="ho.production.title"
        helpKey="ho.production.help"
        tiles={[
          { labelKey: "ho.production.met", value: faculties.production.met },
          { labelKey: "ho.production.required", value: faculties.production.required },
        ]}
        rows={faculties.production.checks.map((check) => ({
          id: check.id,
          title: t(`ho.check.${check.id}` as UiMessageKey),
          meta: check.met ? met : gap,
        }))}
        emptyKey="ho.empty"
        manageHref="/staff/handover"
        manageKey="ho.open.page"
      />
      <LedgerFacultyView
        titleKey="ho.source.title"
        helpKey="ho.source.help"
        tiles={[{ labelKey: "ho.source.apps", value: Number(faculties.source.web) + Number(faculties.source.mobile) }]}
        rows={[
          { id: "web", title: "web", meta: faculties.source.web ? present : absent },
          { id: "mobile", title: "mobile", meta: faculties.source.mobile ? present : absent },
          { id: "android", title: "Android", meta: faculties.source.android ? present : absent },
        ]}
        emptyKey="ho.empty"
        manageHref="/staff/docs/source"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="ho.repository.title"
        helpKey="ho.repository.help"
        tiles={[
          {
            labelKey: "ho.repository.remote.label",
            value: faculties.repository.remote ? present : absent,
          },
          {
            labelKey: "ho.repository.pending",
            value: faculties.repository.dirty ? t("ho.repository.pending.yes") : t("ho.repository.pending.no"),
          },
        ]}
        rows={[]}
        emptyKey="ho.empty"
        hideEmpty
        manageHref="/staff/handover"
        manageKey="ho.open.page"
      />
      <LedgerFacultyView
        titleKey="ho.database.title"
        helpKey="ho.database.help"
        tiles={[
          { labelKey: "ho.database.setting", value: faculties.database.configured ? present : absent },
          { labelKey: "ho.database.read", value: faculties.database.connected ? t("ho.database.connected") : gap },
        ]}
        rows={[]}
        emptyKey="ho.empty"
        hideEmpty
        manageHref="/staff/docs/database"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="ho.cloud.title"
        helpKey="ho.cloud.help"
        tiles={[{ labelKey: "ho.cloud.connected", value: faculties.cloud.filter((item) => item.on).length }]}
        rows={faculties.cloud.map((item) => ({
          id: item.id,
          title: t(`ho.cloud.${item.id}` as UiMessageKey),
          meta: item.on ? present : absent,
        }))}
        emptyKey="ho.empty"
        manageHref="/staff/handover"
        manageKey="ho.open.page"
      />
      <LedgerFacultyView
        titleKey="ho.integrations.title"
        helpKey="ho.integrations.help"
        tiles={[
          { labelKey: "ho.integrations.connected", value: faculties.integrations.connected },
          { labelKey: "ho.integrations.listed", value: faculties.integrations.listed },
        ]}
        rows={faculties.integrations.rows.map((row) => ({
          id: row.id,
          title: t(`dc.channel.${row.id}` as UiMessageKey),
          meta:
            row.id === "email"
              ? t("dc.channel.email.meta")
              : row.id === "whatsapp"
                ? t("dc.channel.whatsapp.meta")
                : row.on
                  ? on
                  : off,
        }))}
        emptyKey="ho.empty"
        manageHref="/staff/docs/integration"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="ho.accounts.title"
        helpKey="ho.accounts.help"
        tiles={[
          { labelKey: "ho.accounts.uat", value: faculties.accounts.uatReady },
          { labelKey: "ho.accounts.uat.required", value: faculties.accounts.uatRequired },
        ]}
        rows={faculties.accounts.roles.map((role) => ({
          id: role.id,
          title: t(`ho.role.${role.id}` as UiMessageKey),
          meta: t("ho.accounts.count", { count: role.count }),
        }))}
        emptyKey="ho.empty"
        manageHref="/staff/users"
        manageKey="ho.accounts.open"
      />
      <LedgerFacultyView
        titleKey="ho.design.title"
        helpKey="ho.design.help"
        tiles={[{ labelKey: "ho.design.logo", value: faculties.design.logo ? present : absent }]}
        rows={[
          { id: "logo", title: t("ho.design.wordmark"), meta: faculties.design.logo ? present : absent },
          { id: "mobile", title: t("ho.design.mobile"), meta: faculties.design.mobile ? present : absent },
          { id: "android", title: "Android", meta: faculties.design.android ? present : absent },
        ]}
        emptyKey="ho.empty"
        manageHref="/staff/brand"
        manageKey="ho.design.open"
      />
      <LedgerFacultyView
        titleKey="ho.documentation.title"
        helpKey="ho.documentation.help"
        tiles={[
          { labelKey: "ho.documentation.documents", value: faculties.documentation.documents },
          { labelKey: "ho.documentation.training", value: faculties.documentation.training },
        ]}
        rows={[]}
        emptyKey="ho.empty"
        hideEmpty
        manageHref="/staff/docs"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="ho.configuration.title"
        helpKey="ho.configuration.help"
        tiles={[{ labelKey: "ho.configuration.env", value: faculties.configuration.env }]}
        rows={faculties.configuration.settings.map((setting) => ({
          id: setting.id,
          title: t(`ho.setting.${setting.id}` as UiMessageKey),
          meta:
            setting.id === "push"
              ? setting.on
                ? t("ho.deployment.push.on")
                : t("ho.deployment.push.off")
              : setting.id === "https" || setting.id === "cookie"
                ? setting.on
                  ? t("ho.on")
                  : t("ho.off")
                : setting.on
                  ? present
                  : absent,
        }))}
        emptyKey="ho.empty"
        manageHref="/staff/handover"
        manageKey="ho.open.page"
      />
      <LedgerFacultyView
        titleKey="ho.credentials.title"
        helpKey="ho.credentials.help"
        tiles={[
          { labelKey: "ho.credentials.held", value: faculties.credentials.held },
          { labelKey: "ho.credentials.listed", value: faculties.credentials.listed },
        ]}
        rows={faculties.credentials.rows.map((row) => ({
          id: row.id,
          title: t(`ho.credentials.${row.id}` as UiMessageKey),
          meta: row.held
            ? t("ho.credentials.client")
            : t(`ho.credentials.where.${row.where}` as UiMessageKey),
        }))}
        emptyKey="ho.empty"
        manageHref="/staff/handover"
        manageKey="ho.open.page"
      />
      <LedgerFacultyView
        titleKey="ho.ownership.title"
        helpKey="ho.ownership.help"
        tiles={[
          { labelKey: "ho.ownership.present", value: faculties.ownership.present },
          {
            labelKey: "ho.ownership.recorded",
            value: faculties.ownership.recorded ? met : t("ho.ownership.no"),
          },
        ]}
        rows={faculties.ownership.rows.map((row) => ({
          id: row.id,
          title: t(`ho.ownership.${row.id}` as UiMessageKey),
          meta: row.present ? present : absent,
        }))}
        emptyKey="ho.empty"
        manageHref="/staff/docs/source"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="ho.infrastructure.title"
        helpKey="ho.infrastructure.help"
        tiles={[
          {
            labelKey: "ho.infrastructure.clear",
            value: faculties.infrastructure.clear ? met : gap,
          },
          { labelKey: "ho.infrastructure.used", value: faculties.infrastructure.used },
        ]}
        rows={faculties.infrastructure.rows.map((row) => ({
          id: row.id,
          title: t(`ho.infrastructure.${row.id}` as UiMessageKey),
          meta: row.used
            ? row.ownerRecorded
              ? t("ho.credentials.client")
              : t("ho.infrastructure.owner")
            : t("ho.infrastructure.idle"),
        }))}
        emptyKey="ho.empty"
        manageHref="/staff/handover"
        manageKey="ho.open.page"
      />
      <LedgerFacultyView
        titleKey="ho.finalTesting.title"
        helpKey="ho.finalTesting.help"
        tiles={[
          {
            labelKey: "ho.finalTesting.signoff",
            value: faculties.finalTesting.signedOff ? met : t("tq.workflow.unsigned"),
          },
          {
            labelKey: "ho.finalTesting.workflows",
            value: faculties.finalTesting.workflowsSigned,
          },
        ]}
        rows={faculties.finalTesting.browsers.map((browser) => ({
          id: browser.id,
          title: t(`tq.browser.${browser.id}` as UiMessageKey),
          meta: browser.opened ? t("tq.browser.checked") : t("tq.browser.notOpened"),
        }))}
        emptyKey="ho.empty"
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="ho.fixes.title"
        helpKey="ho.fixes.help"
        tiles={[
          {
            labelKey: "ho.fixes.signoff",
            value: faculties.fixes.signedOff ? met : t("tq.workflow.unsigned"),
          },
          {
            labelKey: "ho.fixes.register",
            value: faculties.fixes.register ? present : t("ho.fixes.register.no"),
          },
        ]}
        rows={[]}
        emptyKey="ho.empty"
        hideEmpty
        manageHref="/staff/testing"
        manageKey="tq.open"
      />
      <LedgerFacultyView
        titleKey="ho.approval.title"
        helpKey="ho.approval.help"
        tiles={[
          {
            labelKey: "ho.approval.recorded",
            value: faculties.approval.recorded ? met : t("ho.approval.no"),
          },
        ]}
        rows={[]}
        emptyKey="ho.empty"
        hideEmpty
        manageHref="/staff/handover"
        manageKey="ho.open.page"
      />
      <LedgerFacultyView
        titleKey="ho.commercial.title"
        helpKey="ho.commercial.help"
        tiles={[
          { labelKey: "ho.commercial.met", value: faculties.commercial.met },
          { labelKey: "ho.commercial.required", value: faculties.commercial.required },
          {
            labelKey: "ho.commercial.ready",
            value: faculties.commercial.ready ? met : gap,
          },
        ]}
        rows={faculties.commercial.gates.map((gate) => ({
          id: gate.id,
          title: t(`ho.commercial.${gate.id}` as UiMessageKey),
          meta: gate.met ? met : gap,
        }))}
        emptyKey="ho.empty"
        manageHref="/staff/handover"
        manageKey="ho.open.page"
      />
    </div>
  );
}
