import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { fileObjects, files, users } from "@/db/schema";
import { classroomContainsContactDetails } from "@/lib/classroom";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { childIdsFor } from "@/server/crm/scope";

const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
const maxBytes = 1_500_000;

export const studentDocumentSchema = z.object({
  studentUserId: z.string().uuid().optional(),
  filename: z.string().trim().min(1).max(180),
  mimeType: z.enum(allowedTypes),
  contentBase64: z.string().min(8).max(2_100_000),
});

function canReview(actor: ApiActor) {
  return (
    isStaffRole(actor.roleKey) &&
    hasAnyPermission(actor, ["users.read", "safeguarding.incidents", "teachers.documents.review"])
  );
}

async function assertStudent(actor: ApiActor, studentUserId: string) {
  if (actor.roleKey === "student") {
    if (studentUserId !== actor.userId) {
      throw new ApiError(403, "FORBIDDEN", "You can store a document only for your own account");
    }
    return;
  }
  if (actor.roleKey === "parent") {
    const children = await childIdsFor(actor.userId);
    if (!children.includes(studentUserId)) {
      throw new ApiError(403, "FORBIDDEN", "That child is not linked to this account");
    }
    return;
  }
  if (canReview(actor)) return;
  throw new ApiError(403, "FORBIDDEN", "You cannot store a student document");
}

export async function storeStudentDocument(
  actor: ApiActor,
  input: z.infer<typeof studentDocumentSchema>,
  ip?: string,
) {
  const studentUserId =
    actor.roleKey === "student" ? actor.userId : input.studentUserId;
  if (!studentUserId) {
    throw new ApiError(422, "VALIDATION", "Choose the student for this document");
  }
  await assertStudent(actor, studentUserId);
  const filename = input.filename.replace(/[/\\]/g, "").slice(0, 180);
  if (classroomContainsContactDetails(filename)) {
    throw new ApiError(422, "VALIDATION", "Do not put a phone number or email in the file name");
  }
  const content = Buffer.from(input.contentBase64, "base64");
  if (!content.length || content.length > maxBytes) {
    throw new ApiError(422, "VALIDATION", "The document must be under 1.5 MB");
  }

  const [created] = await db
    .insert(files)
    .values({
      ownerUserId: studentUserId,
      purpose: "student_document",
      storageKey: `student-document:${studentUserId}:${crypto.randomUUID()}`,
      mimeType: input.mimeType,
      byteSize: content.length,
      originalName: filename,
      visibility: "private",
    })
    .returning({ id: files.id });
  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not store the document");
  }
  await db.insert(fileObjects).values({ fileId: created.id, content });
  await writeAuditLog({
    actor,
    action: "document.student.stored",
    entityType: "file",
    entityId: created.id,
    metadata: { studentUserId },
    ipAddress: ip,
  });
  return { id: created.id };
}

export async function listStudentDocuments(actor: ApiActor) {
  const scope = await ownerScope(actor);
  const rows = await db
    .select({
      id: files.id,
      title: files.originalName,
      mimeType: files.mimeType,
      createdAt: files.createdAt,
      ownerName: users.displayName,
    })
    .from(files)
    .leftJoin(users, eq(users.id, files.ownerUserId))
    .where(and(eq(files.purpose, "student_document"), eq(files.visibility, "private"), scope))
    .orderBy(desc(files.createdAt))
    .limit(20);
  return rows.map((row) => ({
    id: row.id,
    title: row.title || "Document",
    meta: `${row.ownerName || "Student"} · ${row.createdAt.toISOString().slice(0, 16).replace("T", " ")}`,
  }));
}

export async function readStudentDocument(actor: ApiActor, fileId: string) {
  const scope = await ownerScope(actor);
  const [row] = await db
    .select({
      id: files.id,
      mimeType: files.mimeType,
      originalName: files.originalName,
      content: fileObjects.content,
    })
    .from(files)
    .innerJoin(fileObjects, eq(fileObjects.fileId, files.id))
    .where(
      and(
        eq(files.id, fileId),
        eq(files.purpose, "student_document"),
        eq(files.visibility, "private"),
        scope,
      ),
    )
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "That document is not available");
  }
  await writeAuditLog({
    actor,
    action: "document.student.read",
    entityType: "file",
    entityId: row.id,
    metadata: {},
  });
  return row;
}

async function ownerScope(actor: ApiActor) {
  if (canReview(actor)) return sql`true`;
  if (actor.roleKey === "student") return eq(files.ownerUserId, actor.userId);
  if (actor.roleKey === "parent") {
    const children = await childIdsFor(actor.userId);
    if (!children.length) return sqlFalse();
    return inArray(files.ownerUserId, children);
  }
  return sqlFalse();
}

function sqlFalse() {
  return eq(files.id, "00000000-0000-0000-0000-000000000000");
}

export async function documentSubjects(actor: ApiActor) {
  if (actor.roleKey !== "parent") return [];
  const children = await childIdsFor(actor.userId);
  if (!children.length) return [];
  return db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .where(inArray(users.id, children));
}
