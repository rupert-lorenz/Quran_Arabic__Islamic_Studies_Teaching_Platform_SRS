"use client";

import { LedgerFacultyView } from "@/components/finance/ledger-faculty";
import { useT } from "@/components/i18n/i18n-provider";
import type { UiMessageKey } from "@/lib/i18n";
import type { DocumentationFaculties } from "@/server/docs/faculties";

export function DocumentationFacultiesView({
  faculties,
  section = "all",
}: {
  faculties: DocumentationFaculties;
  section?: "all" | "training";
}) {
  const t = useT();
  const off = t("in.off");
  const on = t("in.on");

  return (
    <div className="space-y-8">
      {section === "training" ? null : (
        <>
      <LedgerFacultyView
        titleKey="dc.overview.title"
        helpKey="dc.overview.help"
        tiles={[
          { labelKey: "dc.documents", value: faculties.overview.documents },
          { labelKey: "dc.sections", value: faculties.overview.sections },
        ]}
        rows={faculties.documents.map((document) => ({
          id: document.id,
          title: t(`dc.${document.id}.title` as UiMessageKey),
          meta: t("dc.sections.count", { count: document.sections }),
        }))}
        emptyKey="dc.empty"
        manageHref="/staff/docs/overview"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="dc.architecture.title"
        helpKey="dc.architecture.help"
        tiles={[
          { labelKey: "dc.architecture.stores", value: faculties.architecture.stores },
          { labelKey: "dc.architecture.modules", value: faculties.architecture.modules },
          { labelKey: "dc.architecture.rules", value: faculties.architecture.rules },
        ]}
        rows={[]}
        emptyKey="dc.empty"
        hideEmpty
        manageHref="/staff/docs/architecture"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="dc.database.title"
        helpKey="dc.database.help"
        tiles={[
          { labelKey: "dc.database.modules", value: faculties.database.modules },
          { labelKey: "dc.database.tables", value: faculties.database.tables },
        ]}
        rows={faculties.database.rows.map((row) => ({
          id: row.id,
          title: row.id,
          meta: t("dc.database.tableCount", { count: row.tables }),
        }))}
        emptyKey="dc.empty"
        manageHref="/staff/docs/database"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="dc.api.title"
        helpKey="dc.api.help"
        tiles={[
          { labelKey: "dc.api.routes", value: faculties.api.routes },
          { labelKey: "dc.api.areas", value: faculties.api.areas },
        ]}
        rows={[]}
        emptyKey="dc.empty"
        hideEmpty
        manageHref="/staff/docs/api"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="dc.integration.title"
        helpKey="dc.integration.help"
        tiles={[
          { labelKey: "dc.integration.connected", value: faculties.integration.connected },
          { labelKey: "dc.integration.listed", value: faculties.integration.listed },
        ]}
        rows={faculties.integration.rows.map((row) => ({
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
        emptyKey="dc.empty"
        manageHref="/staff/docs/integration"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="dc.deployment.title"
        helpKey="dc.deployment.help"
        tiles={[
          { labelKey: "dc.deployment.env", value: faculties.deployment.env },
          { labelKey: "dc.deployment.https", value: faculties.deployment.https ? on : off },
          {
            labelKey: "dc.deployment.db",
            value: faculties.deployment.dbPush ? t("dc.deployment.db.on") : t("dc.deployment.db.off"),
          },
        ]}
        rows={[]}
        emptyKey="dc.empty"
        hideEmpty
        manageHref="/staff/docs/deployment"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="dc.admin.title"
        helpKey="dc.admin.help"
        tiles={[{ labelKey: "dc.sections", value: faculties.guides.admin }]}
        rows={[]}
        emptyKey="dc.empty"
        hideEmpty
        manageHref="/staff/docs/admin"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="dc.teacher.title"
        helpKey="dc.teacher.help"
        tiles={[{ labelKey: "dc.sections", value: faculties.guides.teacher }]}
        rows={[]}
        emptyKey="dc.empty"
        hideEmpty
        manageHref="/staff/docs/teacher"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="dc.student.title"
        helpKey="dc.student.help"
        tiles={[{ labelKey: "dc.sections", value: faculties.guides.student }]}
        rows={[]}
        emptyKey="dc.empty"
        hideEmpty
        manageHref="/staff/docs/student"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="dc.parent.title"
        helpKey="dc.parent.help"
        tiles={[{ labelKey: "dc.sections", value: faculties.guides.parent }]}
        rows={[]}
        emptyKey="dc.empty"
        hideEmpty
        manageHref="/staff/docs/parent"
        manageKey="dc.read"
      />
      <LedgerFacultyView
        titleKey="dc.source.title"
        helpKey="dc.source.help"
        tiles={[
          { labelKey: "dc.source.apps", value: faculties.source.apps },
          { labelKey: "dc.sections", value: faculties.source.sections },
        ]}
        rows={[
          { id: "web", title: "web", meta: "src/app · src/server · src/db · src/components" },
          { id: "mobile", title: "mobile", meta: "iOS · Android" },
        ]}
        emptyKey="dc.empty"
        manageHref="/staff/docs/source"
        manageKey="dc.read"
      />
        </>
      )}
      <LedgerFacultyView
        titleKey="tr.summary.title"
        helpKey="tr.summary.help"
        tiles={[{ labelKey: "tr.roles", value: faculties.training.length }]}
        rows={faculties.training.map((course) => ({
          id: course.id,
          title: t(`tr.${course.id}.title` as UiMessageKey),
          meta: t("dc.sections.count", { count: course.sections }),
        }))}
        emptyKey="dc.empty"
        manageHref="/staff/training"
        manageKey="tr.open"
      />
      {faculties.training.map((course) => (
        <LedgerFacultyView
          key={course.id}
          titleKey={`tr.${course.id}.title` as UiMessageKey}
          helpKey={`tr.${course.id}.help` as UiMessageKey}
          tiles={[{ labelKey: "dc.sections", value: course.sections }]}
          rows={[]}
          emptyKey="dc.empty"
          hideEmpty
          manageHref={course.href}
          manageKey="tr.open"
        />
      ))}
    </div>
  );
}
