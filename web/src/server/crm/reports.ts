import { CRM_REPORTS, type CrmReport, type ExportFormat } from "@/lib/crm";
import { reportToCsv, reportToExcel, reportToPdf, type ReportTable } from "@/lib/report-files";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { getCrmFaculties } from "./faculties";

function table(title: string, columns: string[], rows: string[][]): ReportTable {
  return { title, columns, rows };
}

export async function buildCrmReport(actor: ApiActor, report: CrmReport) {
  const faculties = await getCrmFaculties(actor);
  if (!faculties.exportReports.includes(report)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot export this report");
  }
  const pair = (rows: { title: string; meta: string }[]) =>
    rows.map((row) => [row.title, row.meta]);

  switch (report) {
    case "leads":
      return table(
        "CRM leads",
        ["Name", "Detail"],
        pair(faculties.leads.rows),
      );
    case "followups":
      return table("CRM follow-ups", ["Lead", "Detail"], pair(faculties.followUps.rows));
    case "tickets":
      return table("Support tickets", ["Subject", "Detail"], pair(faculties.tickets.rows));
    case "users":
      return table("User analytics", ["Measure", "Value"], [
        ["Accounts", String(faculties.users?.total ?? 0)],
        ["Active", String(faculties.users?.active ?? 0)],
        ["New in 30 days", String(faculties.users?.newer ?? 0)],
        ["Families", String(faculties.users?.families ?? 0)],
        ["Teachers", String(faculties.users?.teachers ?? 0)],
      ]);
    case "sessions":
      return table("Session analytics", ["Measure", "Value"], [
        ["Live sessions", String(faculties.sessions.live)],
        ["Sessions in 30 days", String(faculties.sessions.recent)],
        ["People in 30 days", String(faculties.sessions.people)],
      ]);
    case "financial":
      return table(
        "Financial analytics",
        ["Group", "Detail"],
        pair(faculties.financial?.rows ?? []),
      );
    case "retention":
      return table("Retention", ["Measure", "Value"], [
        ["Completed", String(faculties.retention.completed)],
        ["Cancelled", String(faculties.retention.cancelled)],
        ["Kept", faculties.retention.rate ?? "None"],
      ]);
    case "academic":
      return table("Academic analytics", ["Measure", "Value"], [
        ["Homework", String(faculties.academic?.homework ?? 0)],
        ["Exams", String(faculties.academic?.exams ?? 0)],
        ["Quizzes", String(faculties.academic?.quizzes ?? 0)],
        ["Certificates", String(faculties.academic?.certificates ?? 0)],
      ]);
    case "marketing":
      return table("Marketing analytics", ["Measure", "Value"], [
        ["Active", String(faculties.marketing?.live ?? 0)],
        ["Draft", String(faculties.marketing?.draft ?? 0)],
        ["Ended", String(faculties.marketing?.ended ?? 0)],
      ]);
    case "trials":
      return table("Trial conversion", ["Measure", "Value"], [
        ["Booked", String(faculties.trials.booked)],
        ["Completed", String(faculties.trials.completed)],
        ["Converted", String(faculties.trials.converted)],
        ["Rate", faculties.trials.rate ?? "None"],
      ]);
    case "people":
      return table("Teacher and student retention", ["Measure", "Value"], [
        ["Teachers kept", faculties.people.teachers ?? "Restricted"],
        ["Students kept", faculties.people.students],
      ]);
    case "revenue":
      return table(
        "Revenue",
        ["Cut", "Amount"],
        pair(faculties.revenue ?? []),
      );
    default:
      return table("Report", ["Detail"], []);
  }
}

export function renderCrmReport(table: ReportTable, format: ExportFormat) {
  if (format === "csv") {
    return {
      body: reportToCsv(table),
      type: "text/csv; charset=utf-8",
      filename: `${table.title}.csv`,
    };
  }
  if (format === "xls") {
    return {
      body: reportToExcel(table),
      type: "application/vnd.ms-excel",
      filename: `${table.title}.xls`,
    };
  }
  return {
    body: reportToPdf(table),
    type: "application/pdf",
    filename: `${table.title}.pdf`,
  };
}

export function isCrmReport(value: string): value is CrmReport {
  return (CRM_REPORTS as readonly string[]).includes(value);
}
