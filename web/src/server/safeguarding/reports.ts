import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { safeguardingIncidentNotes, safeguardingIncidents } from "@/db/schema";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";

const reporterRoles = new Set(["teacher", "parent", "student"]);

export const submitSafeguardingReportSchema = z.object({
  title: z.string().trim().min(3).max(200),
  severity: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string().trim().min(10).max(800),
});

export type SubmitSafeguardingReportInput = z.infer<
  typeof submitSafeguardingReportSchema
>;

function assertCanReport(actor: ApiActor) {
  if (reporterRoles.has(actor.roleKey) || isStaffRole(actor.roleKey)) return;
  throw new ApiError(403, "FORBIDDEN", "This account cannot file a safeguarding report");
}

export async function submitSafeguardingReport(
  actor: ApiActor,
  input: SubmitSafeguardingReportInput,
  ip: string,
) {
  assertCanReport(actor);
  const [created] = await db
    .insert(safeguardingIncidents)
    .values({
      title: input.title,
      severity: input.severity,
      summary: input.summary,
      status: "open",
      createdByUserId: actor.userId,
    })
    .returning({ id: safeguardingIncidents.id, status: safeguardingIncidents.status });
  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not open the report");
  }
  await db.insert(safeguardingIncidentNotes).values({
    incidentId: created.id,
    body: "Report opened.",
    createdByUserId: actor.userId,
  });
  await writeAuditLog({
    actor,
    action: "safeguarding.report_filed",
    entityType: "safeguarding_incident",
    entityId: created.id,
    ipAddress: ip,
    metadata: { severity: input.severity },
  });
  return { id: created.id, status: created.status };
}

export async function listMySafeguardingReports(actor: ApiActor) {
  assertCanReport(actor);
  const rows = await db
    .select({
      id: safeguardingIncidents.id,
      title: safeguardingIncidents.title,
      status: safeguardingIncidents.status,
      createdAt: safeguardingIncidents.createdAt,
    })
    .from(safeguardingIncidents)
    .where(
      and(
        eq(safeguardingIncidents.createdByUserId, actor.userId),
      ),
    )
    .orderBy(desc(safeguardingIncidents.createdAt))
    .limit(20);
  return {
    reports: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
