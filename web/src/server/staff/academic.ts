import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates, subjects, teachingMaterials } from "@/db/schema";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import type {
  CreateCertificateInput,
  CreateSubjectInput,
  UpdateCertificateInput,
  UpdateSubjectInput,
} from "./schemas";

export async function listAcademicWorkspace() {
  const [subjectRows, certificateRows, materialRows] = await Promise.all([
    db.select().from(subjects).orderBy(asc(subjects.sortOrder)),
    db
      .select({
        id: certificates.id,
        name: certificates.name,
        subjectSlug: certificates.subjectSlug,
        subjectName: subjects.name,
        status: certificates.status,
        description: certificates.description,
        heading: certificates.heading,
        awardKind: certificates.awardKind,
        autoIssue: certificates.autoIssue,
        passPercent: certificates.passPercent,
        createdAt: certificates.createdAt,
      })
      .from(certificates)
      .leftJoin(subjects, eq(certificates.subjectSlug, subjects.slug))
      .orderBy(desc(certificates.createdAt)),
    db
      .select({
        status: teachingMaterials.status,
      })
      .from(teachingMaterials),
  ]);

  return {
    summary: {
      subjects: subjectRows.length,
      enabledSubjects: subjectRows.filter((item) => item.isEnabled).length,
      materials: materialRows.length,
      publishedMaterials: materialRows.filter((item) => item.status === "published")
        .length,
      certificates: certificateRows.length,
      activeCertificates: certificateRows.filter((item) => item.status === "active")
        .length,
    },
    subjects: subjectRows,
    certificates: certificateRows,
  };
}

export async function createSubject(
  actor: ApiActor,
  input: CreateSubjectInput,
  ip: string,
) {
  const [existing] = await db
    .select({ slug: subjects.slug })
    .from(subjects)
    .where(eq(subjects.slug, input.slug))
    .limit(1);

  if (existing) {
    throw new ApiError(409, "CONFLICT", "A subject with this slug already exists");
  }

  const [created] = await db
    .insert(subjects)
    .values({
      slug: input.slug,
      name: input.name,
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder ?? 100,
    })
    .returning();

  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not create the subject");
  }

  await writeAuditLog({
    actor,
    action: "academic.subject_created",
    entityType: "subject",
    entityId: created.slug,
    ipAddress: ip,
  });

  return created;
}

export async function updateSubject(
  actor: ApiActor,
  slug: string,
  input: UpdateSubjectInput,
  ip: string,
) {
  const [updated] = await db
    .update(subjects)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() || null }
        : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    })
    .where(eq(subjects.slug, slug))
    .returning();

  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Subject not found");
  }

  await writeAuditLog({
    actor,
    action: "academic.subject_updated",
    entityType: "subject",
    entityId: slug,
    ipAddress: ip,
    metadata: input,
  });

  return updated;
}

export async function createCertificate(
  actor: ApiActor,
  input: CreateCertificateInput,
  ip: string,
) {
  if (input.subjectSlug) {
    const [subject] = await db
      .select({ slug: subjects.slug })
      .from(subjects)
      .where(eq(subjects.slug, input.subjectSlug))
      .limit(1);
    if (!subject) {
      throw new ApiError(404, "NOT_FOUND", "Subject not found");
    }
  }

  const awardKind = input.awardKind ?? "manual";
  const [created] = await db
    .insert(certificates)
    .values({
      name: input.name,
      subjectSlug: input.subjectSlug?.trim() || null,
      description: input.description?.trim() || null,
      heading: input.heading?.trim() || undefined,
      body: input.body?.trim() || null,
      signOff: input.signOff?.trim() || undefined,
      awardKind,
      awardSourceId: awardKind === "manual" ? null : input.awardSourceId ?? null,
      passPercent: input.passPercent ?? 0,
      autoIssue: awardKind === "manual" ? false : Boolean(input.autoIssue),
      createdByUserId: actor.userId,
    })
    .returning();

  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not create the certificate");
  }

  await writeAuditLog({
    actor,
    action: "academic.certificate_created",
    entityType: "certificate",
    entityId: created.id,
    ipAddress: ip,
  });

  return created;
}

export async function updateCertificate(
  actor: ApiActor,
  id: string,
  input: UpdateCertificateInput,
  ip: string,
) {
  const [updated] = await db
    .update(certificates)
    .set({
      ...(input.status ? { status: input.status } : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() || null }
        : {}),
      ...(input.heading !== undefined
        ? { heading: input.heading.trim() || "Certificate of completion" }
        : {}),
      ...(input.body !== undefined ? { body: input.body.trim() || null } : {}),
      ...(input.signOff !== undefined
        ? { signOff: input.signOff.trim() || "Al Haramain Schools" }
        : {}),
      ...(input.awardKind ? { awardKind: input.awardKind } : {}),
      ...(input.awardSourceId !== undefined
        ? {
            awardSourceId:
              input.awardKind === "manual" ? null : input.awardSourceId ?? null,
          }
        : {}),
      ...(input.passPercent !== undefined
        ? { passPercent: input.passPercent }
        : {}),
      ...(input.autoIssue !== undefined
        ? {
            autoIssue:
              input.awardKind === "manual" ? false : input.autoIssue,
          }
        : {}),
    })
    .where(eq(certificates.id, id))
    .returning();

  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Certificate not found");
  }

  await writeAuditLog({
    actor,
    action: "academic.certificate_updated",
    entityType: "certificate",
    entityId: id,
    ipAddress: ip,
    metadata: { status: input.status },
  });

  return updated;
}
