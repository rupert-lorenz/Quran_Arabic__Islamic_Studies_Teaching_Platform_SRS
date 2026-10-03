"use client";

import { LedgerFacultyView } from "@/components/finance/ledger-faculty";
import { useT } from "@/components/i18n/i18n-provider";
import type { getSecurityFaculties } from "@/server/security/faculties";

type Faculties = Awaited<ReturnType<typeof getSecurityFaculties>>;

export function SecurityFacultiesView({ faculties }: { faculties: Faculties }) {
  const t = useT();
  const yes = t("sp.yes");
  const no = t("sp.no");

  return (
    <div className="space-y-8">
      <LedgerFacultyView
        titleKey="sp.ssl.title"
        helpKey="sp.ssl.help"
        tiles={[
          { labelKey: "sp.ssl.address", value: faculties.ssl.https ? "HTTPS" : "HTTP" },
          {
            labelKey: "sp.ssl.cookie",
            value: faculties.ssl.cookieSecure ? t("sp.ssl.secure") : t("sp.ssl.open"),
          },
          { labelKey: "sp.ssl.env", value: faculties.ssl.environment },
        ]}
        rows={[]}
        emptyKey="sp.ssl.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="sp.open"
      />
      <LedgerFacultyView
        titleKey="sp.auth.title"
        helpKey="sp.auth.help"
        tiles={[
          { labelKey: "sp.auth.method", value: t("sp.auth.password") },
          { labelKey: "sp.auth.lockout", value: yes },
          { labelKey: "sp.auth.csrf", value: yes },
        ]}
        rows={[]}
        emptyKey="sp.auth.empty"
        hideEmpty
        manageHref="/login"
        manageKey="sp.auth.open"
      />
      <LedgerFacultyView
        titleKey="sp.password.title"
        helpKey="sp.password.help"
        tiles={[
          { labelKey: "sp.password.algorithm", value: faculties.password.algorithm },
          { labelKey: "sp.password.parameters", value: faculties.password.parameters },
          { labelKey: "sp.password.shown", value: no },
        ]}
        rows={[]}
        emptyKey="sp.password.empty"
        hideEmpty
        manageHref="/account"
        manageKey="sp.password.open"
      />
      <LedgerFacultyView
        titleKey="sp.twoFactor.title"
        helpKey="sp.twoFactor.help"
        tiles={[
          { labelKey: "sp.twoFactor.who", value: t("sp.twoFactor.staff") },
          ...(faculties.twoFactor.staff === null
            ? []
            : [
                { labelKey: "sp.twoFactor.staffCount" as const, value: faculties.twoFactor.staff },
                { labelKey: "sp.twoFactor.enrolled" as const, value: faculties.twoFactor.enrolled ?? 0 },
              ]),
        ]}
        rows={[]}
        emptyKey="sp.twoFactor.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="sp.open"
      />
      <LedgerFacultyView
        titleKey="sp.api.title"
        helpKey="sp.api.help"
        tiles={[
          { labelKey: "sp.api.version", value: faculties.api.version },
          { labelKey: "sp.api.csrf", value: yes },
          { labelKey: "sp.api.limit", value: faculties.api.bodyLimitKb },
        ]}
        rows={[]}
        emptyKey="sp.api.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="sp.open"
      />
      <LedgerFacultyView
        titleKey="sp.rate.title"
        helpKey="sp.rate.help"
        tiles={[
          {
            labelKey: "sp.rate.connected",
            value: faculties.rateLimit.connected ? t("sp.rate.on") : t("sp.rate.off"),
          },
          { labelKey: "sp.rate.window", value: faculties.rateLimit.windowSeconds },
          { labelKey: "sp.rate.public", value: faculties.rateLimit.publicMax },
          { labelKey: "sp.rate.sensitive", value: faculties.rateLimit.sensitiveMax },
        ]}
        rows={[]}
        emptyKey="sp.rate.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="sp.open"
      />
      <LedgerFacultyView
        titleKey="sp.session.title"
        helpKey="sp.session.help"
        tiles={[
          { labelKey: "sp.session.ttl", value: faculties.session.ttlDays },
          { labelKey: "sp.session.yours", value: faculties.session.yours },
          { labelKey: "sp.session.cookie", value: "HttpOnly" },
          {
            labelKey: "sp.session.secure",
            value: faculties.session.secure ? t("sp.ssl.secure") : t("sp.ssl.open"),
          },
        ]}
        rows={[]}
        emptyKey="sp.session.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="sp.open"
      />
      <LedgerFacultyView
        titleKey="sp.files.title"
        helpKey="sp.files.help"
        tiles={[
          {
            labelKey: "sp.files.storage",
            value: faculties.files.storageConnected ? t("sp.rate.on") : t("sp.rate.off"),
          },
          { labelKey: "sp.files.yours", value: faculties.files.yours },
          ...(faculties.files.privateDocuments === null
            ? []
            : [
                {
                  labelKey: "sp.files.private" as const,
                  value: faculties.files.privateDocuments,
                },
              ]),
        ]}
        rows={[]}
        emptyKey="sp.files.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="sp.open"
      />
      <LedgerFacultyView
        titleKey="sp.pay.title"
        helpKey="sp.pay.help"
        tiles={[
          {
            labelKey: "sp.pay.gateway",
            value: faculties.payments.configured
              ? faculties.payments.gateway
              : t("sp.pay.off"),
          },
          { labelKey: "sp.pay.cards", value: no },
        ]}
        rows={[]}
        emptyKey="sp.pay.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="sp.open"
      />
      <LedgerFacultyView
        titleKey="sp.roles.title"
        helpKey="sp.roles.help"
        tiles={[
          { labelKey: "sp.roles.catalog", value: faculties.roles.permissions },
          { labelKey: "sp.roles.yours", value: faculties.roles.yours },
        ]}
        rows={[]}
        emptyKey="sp.roles.empty"
        hideEmpty
        manageHref={faculties.twoFactor.staff === null ? "/account/security" : "/staff/roles"}
        manageKey={faculties.twoFactor.staff === null ? "sp.open" : "sp.roles.open"}
      />
      <LedgerFacultyView
        titleKey="sp.privacy.title"
        helpKey="sp.privacy.help"
        tiles={[
          {
            labelKey: "sp.privacy.state",
            value: faculties.privacy.granted ? t("sp.privacy.accepted") : t("sp.privacy.missing"),
          },
        ]}
        rows={faculties.privacy.rows}
        emptyKey="sp.privacy.empty"
        hideEmpty={faculties.privacy.rows.length === 0}
        manageHref="/account/security"
        manageKey="sp.open"
      />
      <LedgerFacultyView
        titleKey="sp.marketing.title"
        helpKey="sp.marketing.help"
        tiles={[
          {
            labelKey: "sp.marketing.state",
            value: faculties.marketing.granted ? t("sp.marketing.in") : t("sp.marketing.out"),
          },
          {
            labelKey: "sp.marketing.allowed",
            value: faculties.marketing.allowed ? yes : no,
          },
        ]}
        rows={faculties.marketing.rows}
        emptyKey="sp.marketing.empty"
        hideEmpty={faculties.marketing.rows.length === 0}
        manageHref="/account/security"
        manageKey="sp.open"
      />
      <LedgerFacultyView
        titleKey="sp.retention.title"
        helpKey="sp.retention.help"
        tiles={[
          { labelKey: "sp.retention.sessions", value: yes },
          { labelKey: "sp.retention.accounts", value: t("sp.retention.soft") },
          { labelKey: "sp.retention.finance", value: t("sp.retention.kept") },
          { labelKey: "sp.retention.recordings", value: faculties.retention.recordings },
        ]}
        rows={[]}
        emptyKey="sp.retention.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="sp.open"
      />
      <LedgerFacultyView
        titleKey="sp.children.title"
        helpKey="sp.children.help"
        tiles={[
          ...(faculties.children.recordedBirths === null
            ? [
                {
                  labelKey: "sp.children.birth" as const,
                  value: faculties.children.dateOfBirthOnFile ? yes : no,
                },
              ]
            : [
                {
                  labelKey: "sp.children.births" as const,
                  value: faculties.children.recordedBirths,
                },
                {
                  labelKey: "sp.children.under" as const,
                  value: faculties.children.under18Students ?? 0,
                },
              ]),
          ...(faculties.children.linkedChildren === null
            ? []
            : [
                {
                  labelKey: "sp.children.linked" as const,
                  value: faculties.children.linkedChildren,
                },
              ]),
        ]}
        rows={[]}
        emptyKey="sp.children.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="sp.open"
      />
      <LedgerFacultyView
        titleKey="sp.documents.title"
        helpKey="sp.documents.help"
        tiles={[
          { labelKey: "sp.documents.yours", value: faculties.documents.yours },
          ...(faculties.documents.platform === null
            ? []
            : [
                {
                  labelKey: "sp.documents.platform" as const,
                  value: faculties.documents.platform,
                },
              ]),
        ]}
        rows={[]}
        emptyKey="sp.documents.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="sp.open"
      />
    </div>
  );
}
