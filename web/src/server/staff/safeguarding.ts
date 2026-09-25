import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  safeguardingIncidentNotes,
  safeguardingIncidents,
  safeguardingRecordingReviews,
  users,
} from "@/db/schema";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { requireHumanSensitiveDecision } from "@/server/ai/human-decision";
import { ApiError } from "@/server/api/errors";
import { updateDirectoryUser } from "./accounts";
import { findOptionalUserByEmail } from "./lookup";
import type {
  CreateIncidentInput,
  CreateIncidentNoteInput,
  CreateRecordingReviewInput,
  UpdateIncidentInput,
  UpdateRecordingReviewInput,
} from "./schemas";

export async function listSafeguardingWorkspace() {
  const [incidents, notes, recordings, recentAudit] = await Promise.all([
    db
      .select({
        id: safeguardingIncidents.id,
        title: safeguardingIncidents.title,
        severity: safeguardingIncidents.severity,
        status: safeguardingIncidents.status,
        summary: safeguardingIncidents.summary,
        involvedUserId: safeguardingIncidents.involvedUserId,
        involvedEmail: users.email,
        involvedName: users.displayName,
        involvedStatus: users.status,
        createdAt: safeguardingIncidents.createdAt,
      })
      .from(safeguardingIncidents)
      .leftJoin(users, eq(safeguardingIncidents.involvedUserId, users.id))
      .orderBy(desc(safeguardingIncidents.createdAt))
      .limit(100),
    db
      .select()
      .from(safeguardingIncidentNotes)
      .orderBy(desc(safeguardingIncidentNotes.createdAt))
      .limit(200),
    db
      .select({
        id: safeguardingRecordingReviews.id,
        reference: safeguardingRecordingReviews.reference,
        status: safeguardingRecordingReviews.status,
        notes: safeguardingRecordingReviews.notes,
        relatedEmail: users.email,
        relatedName: users.displayName,
        createdAt: safeguardingRecordingReviews.createdAt,
      })
      .from(safeguardingRecordingReviews)
      .leftJoin(users, eq(safeguardingRecordingReviews.relatedUserId, users.id))
      .orderBy(desc(safeguardingRecordingReviews.createdAt))
      .limit(100),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(20),
  ]);

  return {
    summary: {
      openIncidents: incidents.filter(
        (item) => item.status === "open" || item.status === "investigating",
      ).length,
      critical: incidents.filter((item) => item.severity === "critical").length,
      flaggedRecordings: recordings.filter((item) => item.status === "flagged")
        .length,
    },
    incidents: incidents.map((incident) => ({
      ...incident,
      notes: notes.filter((note) => note.incidentId === incident.id),
    })),
    recordings,
    recentAudit,
  };
}

export async function createIncident(
  actor: ApiActor,
  input: CreateIncidentInput,
  ip: string,
) {
  requireHumanSensitiveDecision();
  const involved = await findOptionalUserByEmail(input.involvedEmail);
  const [created] = await db
    .insert(safeguardingIncidents)
    .values({
      title: input.title,
      severity: input.severity,
      summary: input.summary,
      involvedUserId: involved?.id,
      createdByUserId: actor.userId,
    })
    .returning();

  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not create the incident");
  }

  await writeAuditLog({
    actor,
    action: "safeguarding.incident_created",
    entityType: "safeguarding_incident",
    entityId: created.id,
    ipAddress: ip,
    metadata: { severity: input.severity },
  });

  return created;
}

export async function updateIncident(
  actor: ApiActor,
  id: string,
  input: UpdateIncidentInput,
  ip: string,
) {
  requireHumanSensitiveDecision();
  const [updated] = await db
    .update(safeguardingIncidents)
    .set({ status: input.status })
    .where(eq(safeguardingIncidents.id, id))
    .returning();

  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Incident not found");
  }

  await writeAuditLog({
    actor,
    action: "safeguarding.incident_updated",
    entityType: "safeguarding_incident",
    entityId: id,
    ipAddress: ip,
    metadata: { status: input.status },
  });

  return updated;
}

export async function addIncidentNote(
  actor: ApiActor,
  incidentId: string,
  input: CreateIncidentNoteInput,
  ip: string,
) {
  const [incident] = await db
    .select({ id: safeguardingIncidents.id })
    .from(safeguardingIncidents)
    .where(eq(safeguardingIncidents.id, incidentId))
    .limit(1);

  if (!incident) {
    throw new ApiError(404, "NOT_FOUND", "Incident not found");
  }

  const [created] = await db
    .insert(safeguardingIncidentNotes)
    .values({
      incidentId,
      body: input.body,
      createdByUserId: actor.userId,
    })
    .returning();

  await writeAuditLog({
    actor,
    action: "safeguarding.incident_note_added",
    entityType: "safeguarding_incident",
    entityId: incidentId,
    ipAddress: ip,
  });

  return created;
}

export async function suspendInvolvedUser(
  actor: ApiActor,
  incidentId: string,
  ip: string,
) {
  requireHumanSensitiveDecision();
  const [incident] = await db
    .select()
    .from(safeguardingIncidents)
    .where(eq(safeguardingIncidents.id, incidentId))
    .limit(1);

  if (!incident) {
    throw new ApiError(404, "NOT_FOUND", "Incident not found");
  }

  if (!incident.involvedUserId) {
    throw new ApiError(
      400,
      "VALIDATION",
      "This incident has no involved account to suspend",
    );
  }

  const result = await updateDirectoryUser(actor, incident.involvedUserId, {
    status: "suspended",
    ip,
  });

  await db
    .update(safeguardingIncidents)
    .set({ status: "escalated" })
    .where(eq(safeguardingIncidents.id, incidentId));

  return result;
}

export async function createRecordingReview(
  actor: ApiActor,
  input: CreateRecordingReviewInput,
  ip: string,
) {
  const related = await findOptionalUserByEmail(input.relatedEmail);
  const [created] = await db
    .insert(safeguardingRecordingReviews)
    .values({
      reference: input.reference,
      notes: input.notes?.trim() || null,
      relatedUserId: related?.id,
      createdByUserId: actor.userId,
    })
    .returning();

  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not flag the recording");
  }

  await writeAuditLog({
    actor,
    action: "safeguarding.recording_flagged",
    entityType: "recording_review",
    entityId: created.id,
    ipAddress: ip,
  });

  return created;
}

export async function updateRecordingReview(
  actor: ApiActor,
  id: string,
  input: UpdateRecordingReviewInput,
  ip: string,
) {
  const [updated] = await db
    .update(safeguardingRecordingReviews)
    .set({
      status: input.status,
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
    })
    .where(eq(safeguardingRecordingReviews.id, id))
    .returning();

  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Recording review not found");
  }

  await writeAuditLog({
    actor,
    action: "safeguarding.recording_updated",
    entityType: "recording_review",
    entityId: id,
    ipAddress: ip,
    metadata: { status: input.status },
  });

  return updated;
}
