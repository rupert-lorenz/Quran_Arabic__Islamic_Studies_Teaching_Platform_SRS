"use client";

import { useT } from "@/components/i18n/i18n-provider";
import { LedgerFacultyView } from "@/components/finance/ledger-faculty";
import type { UiMessageKey } from "@/lib/i18n";
import type { getSafeguardFaculties } from "@/server/quality/faculties";

type Faculties = Awaited<ReturnType<typeof getSafeguardFaculties>>;

const statusKeys: Record<string, UiMessageKey> = {
  active: "sq.status.active",
  pending: "sq.status.pending",
  suspended: "sq.status.suspended",
  rejected: "sq.status.rejected",
  approved: "sq.status.approved",
};

export function SafeguardFacultiesView({ faculties }: { faculties: Faculties }) {
  const t = useT();
  const restricted = t("sq.restricted");
  const none = t("sq.none");
  const yes = t("sq.yes");
  const no = t("sq.no");
  const count = (value: number | null) => (value === null ? restricted : value);
  const average =
    faculties.ratings.average === null ? none : faculties.ratings.average.toFixed(1);
  const retained =
    faculties.teaching.retained === null ? none : `${faculties.teaching.retained}%`;
  const statusLabel = (value: string | null) =>
    value && statusKeys[value] ? t(statusKeys[value]) : none;

  return (
    <>
      <LedgerFacultyView
        titleKey="sq.ratings.title"
        helpKey="sq.ratings.help"
        manageKey="sq.open.reviews"
        emptyKey="sq.empty"
        manageHref={faculties.links.reviews}
        tiles={[
          { labelKey: "sq.ratings.pending", value: faculties.ratings.pending },
          { labelKey: "sq.ratings.published", value: faculties.ratings.published },
          { labelKey: "sq.ratings.hidden", value: faculties.ratings.hidden },
          { labelKey: "sq.ratings.average", value: average },
        ]}
        rows={faculties.ratings.rows}
      />
      <LedgerFacultyView
        titleKey="sq.moderation.title"
        helpKey="sq.moderation.help"
        manageKey="sq.open.reviews"
        emptyKey="sq.moderation.empty"
        manageHref={faculties.canModerate ? faculties.links.reviews : null}
        tiles={[
          { labelKey: "sq.ratings.pending", value: count(faculties.moderation.pending) },
          { labelKey: "sq.ratings.published", value: count(faculties.moderation.published) },
          { labelKey: "sq.ratings.hidden", value: count(faculties.moderation.hidden) },
          { labelKey: "sq.access.reviews", value: faculties.canModerate ? yes : no },
        ]}
        rows={faculties.moderation.rows}
      />
      <LedgerFacultyView
        titleKey="sq.performance.title"
        helpKey="sq.performance.help"
        manageKey="sq.open.teachers"
        emptyKey="sq.empty"
        hideEmpty
        manageHref={faculties.role === "staff" ? "/staff/teachers" : null}
        tiles={[
          { labelKey: "sq.performance.completed", value: faculties.performance.completed },
          { labelKey: "sq.performance.missed", value: faculties.performance.noShows },
          { labelKey: "sq.performance.cancelled", value: faculties.performance.cancelled },
          { labelKey: "sq.ratings.average", value: average },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="sq.attendance.title"
        helpKey="sq.attendance.help"
        manageKey="sq.open.attendance"
        emptyKey="sq.empty"
        hideEmpty
        manageHref={faculties.links.attendance}
        tiles={[
          { labelKey: "sq.attendance.present", value: faculties.attendance.present },
          { labelKey: "sq.attendance.late", value: faculties.attendance.late },
          { labelKey: "sq.attendance.cancelled", value: faculties.attendance.cancelled },
          { labelKey: "sq.attendance.rescheduled", value: faculties.attendance.rescheduled },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="sq.teaching.title"
        helpKey="sq.teaching.help"
        manageKey="sq.open.reviews"
        emptyKey="sq.empty"
        hideEmpty
        manageHref={faculties.links.reviews}
        tiles={[
          { labelKey: "sq.teaching.retained", value: retained },
          { labelKey: "sq.teaching.complaints", value: faculties.teaching.complaints },
          { labelKey: "sq.ratings.published", value: faculties.teaching.published },
          { labelKey: "sq.ratings.average", value: average },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="sq.risk.title"
        helpKey="sq.risk.help"
        manageKey="sq.open.teachers"
        emptyKey="sq.empty"
        hideEmpty
        manageHref={faculties.role === "staff" ? "/staff/teachers" : null}
        tiles={[
          { labelKey: "sq.risk.rating", value: count(faculties.risk.lowRating) },
          { labelKey: "sq.risk.missed", value: count(faculties.risk.noShows) },
          { labelKey: "sq.risk.contact", value: faculties.risk.flags },
          { labelKey: "sq.risk.holds", value: count(faculties.risk.holds) },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="sq.alerts.title"
        helpKey="sq.alerts.help"
        manageKey="sq.open.safeguarding"
        emptyKey="sq.alerts.empty"
        manageHref={faculties.links.safeguarding}
        tiles={[
          { labelKey: "sq.alerts.total", value: faculties.alerts.total },
          { labelKey: "sq.secure.messages", value: faculties.secure.teacherStudent + faculties.secure.teacherParent + faculties.secure.teacherAdmin + faculties.secure.familyAdmin },
          { labelKey: "sq.access.reports", value: faculties.canIncidents ? yes : no },
          { labelKey: "sq.access.recordings", value: faculties.canRecordings ? yes : no },
        ]}
        rows={faculties.alerts.rows}
      />
      <LedgerFacultyView
        titleKey="sq.payments.title"
        helpKey="sq.payments.help"
        manageKey="sq.open.accounts"
        emptyKey="sq.payments.empty"
        manageHref={faculties.links.accounts}
        tiles={[
          { labelKey: "sq.payments.flagged", value: faculties.payments.total },
          { labelKey: "sq.risk.holds", value: count(faculties.risk.holds) },
          {
            labelKey: "sq.payments.kinds",
            value:
              faculties.role === "parent"
                ? t("sq.payments.family")
                : faculties.role === "teacher"
                  ? t("sq.payments.own")
                  : t("sq.payments.desk"),
          },
          { labelKey: "sq.access.accounts", value: faculties.role === "staff" ? yes : no },
        ]}
        rows={faculties.payments.rows}
      />
      <LedgerFacultyView
        titleKey="sq.children.title"
        helpKey="sq.children.help"
        manageKey="sq.open.family"
        emptyKey="sq.empty"
        hideEmpty
        manageHref={faculties.role === "parent" ? "/family" : faculties.links.safeguarding}
        tiles={[
          { labelKey: "sq.children.links", value: faculties.children.links },
          { labelKey: "sq.children.reports", value: count(faculties.children.incidents) },
          { labelKey: "sq.access.reports", value: faculties.canIncidents ? yes : no },
          { labelKey: "sq.secure.parent", value: faculties.secure.teacherParent },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="sq.secure.title"
        helpKey="sq.secure.help"
        manageKey="sq.open.messages"
        emptyKey="sq.empty"
        hideEmpty
        manageHref="/messages"
        tiles={[
          { labelKey: "sq.secure.student", value: faculties.secure.teacherStudent },
          { labelKey: "sq.secure.parent", value: faculties.secure.teacherParent },
          { labelKey: "sq.secure.teacher", value: faculties.secure.teacherAdmin },
          { labelKey: "sq.secure.family", value: faculties.secure.familyAdmin },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="sq.incidents.title"
        helpKey="sq.incidents.help"
        manageKey="sq.open.safeguarding"
        emptyKey="sq.incidents.empty"
        manageHref={faculties.links.safeguarding}
        extraHref="/safeguarding"
        extraKey="sq.incidents.report"
        tiles={[
          { labelKey: "sq.incidents.open", value: count(faculties.incidents.open) },
          { labelKey: "sq.incidents.investigating", value: count(faculties.incidents.investigating) },
          { labelKey: "sq.incidents.escalated", value: count(faculties.incidents.escalated) },
          { labelKey: "sq.incidents.closed", value: count(faculties.incidents.closed) },
        ]}
        rows={faculties.incidents.rows}
      />
      <LedgerFacultyView
        titleKey="sq.access.title"
        helpKey="sq.access.help"
        manageKey="sq.open.safeguarding"
        emptyKey="sq.empty"
        hideEmpty
        manageHref={faculties.links.safeguarding}
        tiles={[
          { labelKey: "sq.access.reports", value: faculties.canIncidents ? yes : no },
          { labelKey: "sq.access.recordings", value: faculties.canRecordings ? yes : no },
          { labelKey: "sq.access.suspend", value: faculties.canSuspend ? yes : no },
          { labelKey: "sq.access.reviews", value: faculties.canModerate ? yes : no },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="sq.investigation.title"
        helpKey="sq.investigation.help"
        manageKey="sq.open.safeguarding"
        emptyKey="sq.incidents.empty"
        manageHref={faculties.links.safeguarding}
        tiles={[
          { labelKey: "sq.incidents.open", value: count(faculties.incidents.open) },
          { labelKey: "sq.incidents.investigating", value: count(faculties.incidents.investigating) },
          { labelKey: "sq.incidents.notes", value: count(faculties.incidents.notes) },
          { labelKey: "sq.incidents.escalated", value: count(faculties.incidents.escalated) },
        ]}
        rows={faculties.incidents.rows}
      />
      <LedgerFacultyView
        titleKey="sq.suspension.title"
        helpKey="sq.suspension.help"
        manageKey="sq.open.users"
        emptyKey="sq.suspension.empty"
        manageHref={faculties.links.users}
        tiles={[
          { labelKey: "sq.suspension.users", value: count(faculties.suspension.users) },
          { labelKey: "sq.suspension.teachers", value: count(faculties.suspension.teachers) },
          { labelKey: "sq.suspension.yours", value: statusLabel(faculties.suspension.ownStatus) },
          {
            labelKey: "sq.suspension.verification",
            value: statusLabel(faculties.suspension.ownVerification),
          },
        ]}
        rows={faculties.suspension.rows}
      />
      <LedgerFacultyView
        titleKey="sq.recordings.title"
        helpKey="sq.recordings.help"
        manageKey="sq.open.safeguarding"
        emptyKey="sq.recordings.empty"
        manageHref={faculties.links.safeguarding}
        tiles={[
          { labelKey: "sq.recordings.flagged", value: count(faculties.recordings.flagged) },
          { labelKey: "sq.recordings.review", value: count(faculties.recordings.underReview) },
          { labelKey: "sq.recordings.cleared", value: count(faculties.recordings.cleared) },
          { labelKey: "sq.alerts.total", value: faculties.alerts.total },
        ]}
        rows={faculties.recordings.rows}
      />
    </>
  );
}
