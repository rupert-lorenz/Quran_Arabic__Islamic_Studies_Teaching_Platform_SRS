export const INCIDENT_STATUSES = [
  "open",
  "investigating",
  "escalated",
  "resolved",
  "closed",
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

const NEXT: Record<IncidentStatus, readonly IncidentStatus[]> = {
  open: ["investigating"],
  investigating: ["escalated", "resolved"],
  escalated: ["investigating", "resolved"],
  resolved: ["closed"],
  closed: [],
};

export function isIncidentStatus(value: string): value is IncidentStatus {
  return (INCIDENT_STATUSES as readonly string[]).includes(value);
}

export function nextIncidentStatuses(status: string): IncidentStatus[] {
  if (!isIncidentStatus(status)) return [];
  return [...NEXT[status]];
}

export function canMoveIncident(from: string, to: string) {
  return nextIncidentStatuses(from).includes(to as IncidentStatus);
}
