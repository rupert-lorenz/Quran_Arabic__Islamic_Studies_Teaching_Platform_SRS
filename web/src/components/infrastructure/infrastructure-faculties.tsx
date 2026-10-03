"use client";

import { LedgerFacultyView } from "@/components/finance/ledger-faculty";
import { useT } from "@/components/i18n/i18n-provider";
import type { UiMessageKey } from "@/lib/i18n";
import type { getInfrastructureFaculties } from "@/server/infrastructure/faculties";

type Faculties = Awaited<ReturnType<typeof getInfrastructureFaculties>>;

export function InfrastructureFacultiesView({ faculties }: { faculties: Faculties }) {
  const t = useT();
  const yes = t("in.yes");
  const no = t("in.no");

  return (
    <div className="space-y-8">
      <LedgerFacultyView
        titleKey="in.docs.title"
        helpKey="in.docs.help"
        tiles={[
          ...(faculties.documents.identity === null
            ? []
            : [
                { labelKey: "in.docs.identity" as const, value: faculties.documents.identity },
                {
                  labelKey: "in.docs.qualification" as const,
                  value: faculties.documents.qualification ?? 0,
                },
              ]),
          { labelKey: "in.docs.student", value: faculties.documents.student },
          { labelKey: "in.docs.public", value: faculties.documents.publicSensitive },
        ]}
        rows={faculties.documents.rows}
        emptyKey="in.docs.empty"
        manageHref="/account/security"
        manageKey="in.docs.open"
      />
      <LedgerFacultyView
        titleKey="in.rec.title"
        helpKey="in.rec.help"
        tiles={[
          { labelKey: "in.rec.days", value: faculties.recordings.retentionDays },
          { labelKey: "in.rec.total", value: faculties.recordings.total },
          { labelKey: "in.rec.stored", value: faculties.recordings.stored },
          { labelKey: "in.rec.kept", value: faculties.recordings.retained },
          {
            labelKey: "in.rec.storage",
            value: faculties.recordings.storage ? t("in.on") : t("in.off"),
          },
        ]}
        rows={[]}
        emptyKey="in.rec.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="in.open"
      />
      <LedgerFacultyView
        titleKey="in.audit.title"
        helpKey="in.audit.help"
        tiles={[
          {
            labelKey: "in.audit.total",
            value: faculties.audit.total === null ? t("in.audit.staff") : faculties.audit.total,
          },
        ]}
        rows={faculties.audit.rows}
        emptyKey="in.audit.empty"
        hideEmpty={!faculties.audit.visible}
        manageHref="/account/security"
        manageKey="in.open"
      />
      <LedgerFacultyView
        titleKey="in.scale.title"
        helpKey="in.scale.help"
        tiles={[
          { labelKey: "in.scale.database", value: faculties.scale.database },
          { labelKey: "in.scale.cache", value: faculties.scale.cache ? t("in.on") : t("in.off") },
          { labelKey: "in.scale.storage", value: faculties.scale.storage ? t("in.on") : t("in.off") },
          { labelKey: "in.scale.pool", value: faculties.scale.pool },
        ]}
        rows={faculties.scale.domains.map((row) => ({
          id: row.id,
          title: t(`in.scale.${row.id}` as UiMessageKey),
          meta:
            row.id === "lessons"
              ? t("in.scale.lessons.meta", { booked: row.booked, group: row.group })
              : row.id === "courses"
                ? t("in.scale.courses.meta", { live: row.live, recorded: row.recorded })
                : t("in.scale.records", { count: row.count }),
        }))}
        emptyKey="in.scale.empty"
        manageHref="/account/security"
        manageKey="in.open"
      />
      <LedgerFacultyView
        titleKey="in.perf.title"
        helpKey="in.perf.help"
        tiles={[
          { labelKey: "in.perf.sessions", value: faculties.performance.sessionCache ? yes : no },
          { labelKey: "in.perf.limit", value: faculties.performance.rateLimit ? yes : no },
          { labelKey: "in.perf.pool", value: faculties.performance.pool },
        ]}
        rows={[]}
        emptyKey="in.perf.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="in.open"
      />
      <LedgerFacultyView
        titleKey="in.cdn.title"
        helpKey="in.cdn.help"
        tiles={[
          { labelKey: "in.cdn.state", value: faculties.cdn.connected ? t("in.on") : t("in.off") },
        ]}
        rows={[]}
        emptyKey="in.cdn.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="in.open"
      />
      <LedgerFacultyView
        titleKey="in.ha.title"
        helpKey="in.ha.help"
        tiles={[
          { labelKey: "in.ha.login", value: t("in.ha.here") },
          { labelKey: "in.ha.booking", value: t("in.ha.here") },
          { labelKey: "in.ha.payments", value: t("in.ha.here") },
          { labelKey: "in.ha.classroom", value: t("in.ha.here") },
          { labelKey: "in.ha.replicas", value: faculties.availability.replicas },
        ]}
        rows={[]}
        emptyKey="in.ha.empty"
        hideEmpty
        manageHref="/account/security"
        manageKey="in.open"
      />
      <LedgerFacultyView
        titleKey="in.int.title"
        helpKey="in.int.help"
        tiles={[{ labelKey: "in.int.count", value: faculties.integrations.rows.length }]}
        rows={faculties.integrations.rows.map((row) => ({
          id: row.id,
          title: t(`in.int.${row.id}.title` as UiMessageKey),
          meta: t(`in.int.${row.id}.${row.note}` as UiMessageKey),
        }))}
        emptyKey="in.int.empty"
        manageHref="/account/security"
        manageKey="in.open"
      />
    </div>
  );
}
