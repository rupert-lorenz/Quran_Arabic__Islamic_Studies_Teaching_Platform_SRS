"use client";

import { LedgerFacultyView } from "@/components/finance/ledger-faculty";
import { useT } from "@/components/i18n/i18n-provider";
import type { UiMessageKey } from "@/lib/i18n";
import { CRM_REPORTS, type CrmReport } from "@/lib/crm";
import type { getCrmFaculties } from "@/server/crm/faculties";

type Faculties = Awaited<ReturnType<typeof getCrmFaculties>>;

const statusKeys: Record<string, UiMessageKey> = {
  lead: "cr.status.lead",
  registered: "cr.status.registered",
  trial_booked: "cr.status.trial_booked",
  trial_completed: "cr.status.trial_completed",
  active: "cr.status.active",
  inactive: "cr.status.inactive",
  cancelled: "cr.status.cancelled",
};

const reportKeys: Record<CrmReport, UiMessageKey> = {
  leads: "cr.leads.title",
  followups: "cr.followups.title",
  tickets: "cr.tickets.title",
  users: "cr.users.title",
  sessions: "cr.sessions.title",
  financial: "cr.financial.title",
  retention: "cr.retention.title",
  academic: "cr.academic.title",
  marketing: "cr.marketing.title",
  trials: "cr.trials.title",
  people: "cr.people.title",
  revenue: "cr.revenue.title",
};

function Exports({
  report,
  reports,
}: {
  report: CrmReport;
  reports: readonly string[];
}) {
  const t = useT();
  if (!reports.includes(report)) return null;
  return (
    <p className="-mt-2 mb-4 flex flex-wrap gap-4 text-sm font-bold">
      {(["csv", "xls", "pdf"] as const).map((format) => (
        <a
          key={format}
          href={`/api/v1/crm/export?report=${report}&format=${format}`}
          className="text-brand-accent underline"
        >
          {t(`cr.export.${format}`)}
        </a>
      ))}
    </p>
  );
}

export function CrmFacultiesView({ faculties }: { faculties: Faculties }) {
  const t = useT();
  const restricted = t("cr.restricted");
  const none = t("cr.none");
  const count = (value: number | null | undefined) =>
    value === null || value === undefined ? restricted : value;
  const percent = (value: string | null) => value ?? none;
  const reports = faculties.exportReports;

  return (
    <>
      <LedgerFacultyView
        titleKey="cr.overview.title"
        helpKey="cr.overview.help"
        manageKey="cr.open.crm"
        emptyKey="cr.leads.empty"
        hideEmpty
        manageHref={faculties.statuses ? "/staff/crm" : "/support"}
        tiles={[
          { labelKey: "cr.overview.leads", value: count(faculties.overview.leads) },
          { labelKey: "cr.overview.tickets", value: faculties.overview.tickets },
          { labelKey: "cr.overview.articles", value: faculties.overview.articles },
          { labelKey: "cr.overview.exports", value: faculties.overview.exports },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="cr.leads.title"
        helpKey="cr.leads.help"
        manageKey="cr.open.crm"
        emptyKey="cr.leads.empty"
        manageHref={faculties.statuses ? "/staff/crm" : null}
        tiles={[{ labelKey: "cr.leads.total", value: count(faculties.leads.total) }]}
        rows={faculties.leads.rows}
      />
      <Exports report="leads" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.statuses.title"
        helpKey="cr.statuses.help"
        manageKey="cr.open.crm"
        emptyKey="cr.leads.empty"
        hideEmpty
        manageHref={faculties.statuses ? "/staff/crm" : null}
        tiles={(
          [
            "lead",
            "registered",
            "trial_booked",
            "trial_completed",
            "active",
            "inactive",
            "cancelled",
          ] as const
        ).map((status) => ({
          labelKey: statusKeys[status],
          value: count(
            faculties.statuses
              ? status === "trial_booked"
                ? faculties.statuses.trialBooked
                : status === "trial_completed"
                  ? faculties.statuses.trialCompleted
                  : faculties.statuses[status]
              : null,
          ),
        }))}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="cr.followups.title"
        helpKey="cr.followups.help"
        manageKey="cr.open.crm"
        emptyKey="cr.leads.empty"
        manageHref={faculties.statuses ? "/staff/crm" : null}
        tiles={[
          { labelKey: "cr.followups.due", value: count(faculties.followUps.due) },
          { labelKey: "cr.followups.overdue", value: count(faculties.followUps.overdue) },
        ]}
        rows={faculties.followUps.rows}
      />
      <Exports report="followups" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.help.title"
        helpKey="cr.help.help"
        manageKey="cr.help.open"
        emptyKey="cr.help.empty"
        hideEmpty
        manageHref="/help"
        tiles={[
          { labelKey: "cr.help.articles", value: faculties.help.articles },
          { labelKey: "cr.help.faqs", value: faculties.help.faqs },
          { labelKey: "cr.help.pages", value: faculties.help.pages },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="cr.tickets.title"
        helpKey="cr.tickets.help"
        manageKey="cr.open.support"
        emptyKey="cr.tickets.empty"
        manageHref="/support"
        extraHref={faculties.ticketFields.unassigned !== null ? "/staff/crm" : null}
        extraKey="cr.open.crm"
        tiles={[
          { labelKey: "cr.tickets.open", value: faculties.tickets.open },
          { labelKey: "cr.tickets.mine", value: faculties.tickets.mine },
          { labelKey: "cr.tickets.waiting", value: faculties.tickets.waiting },
          { labelKey: "cr.tickets.closed", value: faculties.tickets.closed },
        ]}
        rows={faculties.tickets.rows}
      />
      <Exports report="tickets" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.fields.title"
        helpKey="cr.fields.help"
        manageKey="cr.open.support"
        emptyKey="cr.tickets.empty"
        manageHref="/support"
        tiles={[
          { labelKey: "cr.fields.categories", value: faculties.ticketFields.categories },
          { labelKey: "cr.fields.attachments", value: faculties.ticketFields.attachments },
          { labelKey: "cr.fields.unassigned", value: count(faculties.ticketFields.unassigned) },
          { labelKey: "cr.fields.owners", value: count(faculties.ticketFields.owners) },
        ]}
        rows={faculties.ticketFields.rows}
      />
      <LedgerFacultyView
        titleKey="cr.users.title"
        helpKey="cr.users.help"
        manageKey="cr.open.crm"
        emptyKey="cr.leads.empty"
        hideEmpty
        manageHref={faculties.users ? "/staff/crm" : null}
        tiles={[
          { labelKey: "cr.users.total", value: count(faculties.users?.total) },
          { labelKey: "cr.users.active", value: count(faculties.users?.active) },
          { labelKey: "cr.users.newer", value: count(faculties.users?.newer) },
          { labelKey: "cr.users.families", value: count(faculties.users?.families) },
        ]}
        rows={[]}
      />
      <Exports report="users" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.sessions.title"
        helpKey="cr.sessions.help"
        manageKey="cr.open.crm"
        emptyKey="cr.leads.empty"
        hideEmpty
        manageHref={faculties.sessions.platform ? "/staff/crm" : null}
        tiles={[
          { labelKey: "cr.sessions.live", value: faculties.sessions.live },
          { labelKey: "cr.sessions.recent", value: faculties.sessions.recent },
          { labelKey: "cr.sessions.people", value: faculties.sessions.people },
        ]}
        rows={[]}
      />
      <Exports report="sessions" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.financial.title"
        helpKey="cr.financial.help"
        manageKey="cr.open.crm"
        emptyKey="cr.financial.empty"
        manageHref={faculties.staff && faculties.financial ? "/staff/accounts" : null}
        tiles={[
          { labelKey: "cr.financial.payments", value: count(faculties.financial?.payments) },
          { labelKey: "cr.financial.refunds", value: count(faculties.financial?.refunds) },
          { labelKey: "cr.financial.holds", value: count(faculties.financial?.holds) },
          { labelKey: "cr.financial.payouts", value: count(faculties.financial?.payouts) },
        ]}
        rows={faculties.financial?.rows ?? []}
      />
      <Exports report="financial" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.retention.title"
        helpKey="cr.retention.help"
        manageKey="cr.open.crm"
        emptyKey="cr.leads.empty"
        hideEmpty
        manageHref={null}
        tiles={[
          { labelKey: "cr.retention.completed", value: faculties.retention.completed },
          { labelKey: "cr.retention.cancelled", value: faculties.retention.cancelled },
          { labelKey: "cr.retention.rate", value: percent(faculties.retention.rate) },
        ]}
        rows={[]}
      />
      <Exports report="retention" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.academic.title"
        helpKey="cr.academic.help"
        manageKey="cr.open.crm"
        emptyKey="cr.leads.empty"
        hideEmpty
        manageHref={faculties.staff && faculties.academic ? "/staff/academic" : null}
        tiles={[
          { labelKey: "cr.academic.homework", value: count(faculties.academic?.homework) },
          { labelKey: "cr.academic.exams", value: count(faculties.academic?.exams) },
          { labelKey: "cr.academic.quizzes", value: count(faculties.academic?.quizzes) },
          { labelKey: "cr.academic.certificates", value: count(faculties.academic?.certificates) },
        ]}
        rows={[]}
      />
      <Exports report="academic" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.marketing.title"
        helpKey="cr.marketing.help"
        manageKey="cr.open.crm"
        emptyKey="cr.leads.empty"
        hideEmpty
        manageHref={faculties.marketing ? "/staff/marketing" : null}
        tiles={[
          { labelKey: "cr.marketing.live", value: count(faculties.marketing?.live) },
          { labelKey: "cr.marketing.draft", value: count(faculties.marketing?.draft) },
          { labelKey: "cr.marketing.ended", value: count(faculties.marketing?.ended) },
        ]}
        rows={[]}
      />
      <Exports report="marketing" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.trials.title"
        helpKey="cr.trials.help"
        manageKey="cr.open.crm"
        emptyKey="cr.leads.empty"
        hideEmpty
        manageHref={null}
        tiles={[
          { labelKey: "cr.trials.booked", value: faculties.trials.booked },
          { labelKey: "cr.trials.completed", value: faculties.trials.completed },
          { labelKey: "cr.trials.converted", value: faculties.trials.converted },
          { labelKey: "cr.trials.rate", value: percent(faculties.trials.rate) },
        ]}
        rows={[]}
      />
      <Exports report="trials" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.people.title"
        helpKey="cr.people.help"
        manageKey="cr.open.crm"
        emptyKey="cr.leads.empty"
        hideEmpty
        manageHref={null}
        tiles={[
          { labelKey: "cr.people.teachers", value: faculties.people.teachers ?? restricted },
          { labelKey: "cr.people.students", value: faculties.people.students },
        ]}
        rows={[]}
      />
      <Exports report="people" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.revenue.title"
        helpKey="cr.revenue.help"
        manageKey="cr.open.crm"
        emptyKey="cr.revenue.empty"
        manageHref={faculties.staff && faculties.revenue ? "/staff/crm" : null}
        tiles={[{ labelKey: "cr.overview.exports", value: faculties.revenue?.length ?? restricted }]}
        rows={faculties.revenue ?? []}
      />
      <Exports report="revenue" reports={reports} />
      <LedgerFacultyView
        titleKey="cr.export.title"
        helpKey="cr.export.help"
        manageKey="cr.open.crm"
        emptyKey="cr.export.empty"
        manageHref={null}
        tiles={[{ labelKey: "cr.overview.exports", value: reports.length }]}
        rows={CRM_REPORTS.filter((report) => reports.includes(report)).map((report) => ({
          id: report,
          title: t(reportKeys[report]),
          meta: `${t("cr.export.csv")} · ${t("cr.export.xls")} · ${t("cr.export.pdf")}`,
        }))}
      />
    </>
  );
}
