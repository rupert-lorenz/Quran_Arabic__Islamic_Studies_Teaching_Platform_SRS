export const CRM_STATUSES = [
  "lead",
  "registered",
  "trial_booked",
  "trial_completed",
  "active",
  "inactive",
  "cancelled",
] as const;

export type CrmStatus = (typeof CRM_STATUSES)[number];

export const TICKET_CATEGORIES = [
  "lesson",
  "billing",
  "account",
  "technical",
  "other",
] as const;

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
] as const;

export const CRM_REPORTS = [
  "leads",
  "followups",
  "tickets",
  "users",
  "sessions",
  "financial",
  "retention",
  "academic",
  "marketing",
  "trials",
  "people",
  "revenue",
] as const;

export type CrmReport = (typeof CRM_REPORTS)[number];

export const EXPORT_FORMATS = ["csv", "xls", "pdf"] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isCrmStatus(value: string): value is CrmStatus {
  return (CRM_STATUSES as readonly string[]).includes(value);
}
