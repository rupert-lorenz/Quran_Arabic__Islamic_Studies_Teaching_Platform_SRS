import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  files,
  teacherDocumentReviews,
  teacherProfiles,
  users,
} from "@/db/schema";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { sendAccountEmail } from "@/server/auth/mail";
import type { ReviewTeacherDocumentInput, TeacherDocumentType } from "./schemas";
import { recordApplicationEvent } from "./status";

const identityTypes = ["passport", "national_id", "residence_permit", "other"] as const;
const qualificationTypes = ["ijazah", "degree", "teaching_certificate", "other"] as const;

export function defaultDocumentType(
  purpose: "identity" | "qualification" | "intro_video",
): TeacherDocumentType {
  if (purpose === "identity") {
    return "passport";
  }
  if (purpose === "qualification") {
    return "ijazah";
  }
  return "other";
}

export function assertDocumentTypeForPurpose(
  purpose: "identity" | "qualification",
  documentType: TeacherDocumentType,
) {
  const allowed: readonly TeacherDocumentType[] =
    purpose === "identity" ? identityTypes : qualificationTypes;
  if (!allowed.includes(documentType)) {
    throw new ApiError(
      422,
      "VALIDATION",
      purpose === "identity"
        ? "Choose a passport, national ID, residence permit, or other identity document"
        : "Choose an ijazah, degree, teaching certificate, or other qualification",
    );
  }
}

export async function createPendingDocumentReview(
  teacherUserId: string,
  fileId: string,
  documentType: TeacherDocumentType,
) {
  await db
    .insert(teacherDocumentReviews)
    .values({
      fileId,
      teacherUserId,
      documentType,
      status: "pending",
    })
    .onConflictDoNothing({ target: teacherDocumentReviews.fileId });
}

export async function ensureDocumentReviews(teacherUserId: string) {
  const fileRows = await db
    .select({
      id: files.id,
      purpose: files.purpose,
    })
    .from(files)
    .where(
      and(
        eq(files.ownerUserId, teacherUserId),
        inArray(files.purpose, ["identity", "qualification", "intro_video"]),
      ),
    );

  const existing = await db
    .select({ fileId: teacherDocumentReviews.fileId })
    .from(teacherDocumentReviews)
    .where(eq(teacherDocumentReviews.teacherUserId, teacherUserId));
  const known = new Set(existing.map((item) => item.fileId));

  const missing = fileRows.filter((file) => !known.has(file.id));
  if (missing.length === 0) {
    return;
  }

  await db
    .insert(teacherDocumentReviews)
    .values(
      missing.map((file) => ({
        fileId: file.id,
        teacherUserId,
        documentType: defaultDocumentType(
          file.purpose as "identity" | "qualification" | "intro_video",
        ),
        status: "pending" as const,
      })),
    )
    .onConflictDoNothing({ target: teacherDocumentReviews.fileId });
}

export async function listDocumentReviews(teacherUserIds: string[]) {
  if (teacherUserIds.length === 0) {
    return [];
  }

  return db
    .select({
      fileId: teacherDocumentReviews.fileId,
      teacherUserId: teacherDocumentReviews.teacherUserId,
      documentType: teacherDocumentReviews.documentType,
      status: teacherDocumentReviews.status,
      note: teacherDocumentReviews.note,
      reviewedAt: teacherDocumentReviews.reviewedAt,
    })
    .from(teacherDocumentReviews)
    .where(inArray(teacherDocumentReviews.teacherUserId, teacherUserIds));
}

export function documentChecklist(input: {
  documents: {
    purpose: string;
    reviewStatus?: string | null;
  }[];
  video: { reviewStatus?: string | null } | null;
}) {
  const identityStatus = purposeReviewStatus(input.documents, "identity");
  const qualificationStatus = purposeReviewStatus(
    input.documents,
    "qualification",
  );
  const videoStatus = purposeReviewStatus(
    input.video ? [{ purpose: "intro_video", reviewStatus: input.video.reviewStatus }] : [],
    "intro_video",
  );
  const identityVerified = identityStatus === "verified";
  const qualificationVerified = qualificationStatus === "verified";
  const videoVerified = videoStatus === "verified";
  const awaitingReview =
    identityStatus === "pending" ||
    qualificationStatus === "pending" ||
    videoStatus === "pending";
  const needsReplacement =
    identityStatus === "rejected" ||
    qualificationStatus === "rejected" ||
    videoStatus === "rejected";

  return {
    identityVerified,
    qualificationVerified,
    videoVerified,
    identityStatus,
    qualificationStatus,
    videoStatus,
    awaitingReview,
    needsReplacement,
    readyToApprove: identityVerified && qualificationVerified && videoVerified,
  };
}

export type DocumentReviewStatus =
  | "verified"
  | "pending"
  | "rejected"
  | "missing";

function purposeReviewStatus(
  documents: { purpose: string; reviewStatus?: string | null }[],
  purpose: string,
): DocumentReviewStatus {
  const items = documents.filter((item) => item.purpose === purpose);
  if (items.some((item) => item.reviewStatus === "verified")) {
    return "verified";
  }
  if (
    items.some(
      (item) =>
        item.reviewStatus === "rejected" || item.reviewStatus === "more_info",
    )
  ) {
    return "rejected";
  }
  if (items.length) {
    return "pending";
  }
  return "missing";
}

export async function reviewTeacherDocument(
  actor: ApiActor,
  fileId: string,
  input: ReviewTeacherDocumentInput,
  ip: string,
) {
  const [file] = await db
    .select({
      id: files.id,
      purpose: files.purpose,
      ownerUserId: files.ownerUserId,
      email: users.email,
      verificationStatus: teacherProfiles.verificationStatus,
    })
    .from(files)
    .leftJoin(users, eq(files.ownerUserId, users.id))
    .leftJoin(teacherProfiles, eq(files.ownerUserId, teacherProfiles.userId))
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file?.ownerUserId || !file.verificationStatus) {
    throw new ApiError(404, "NOT_FOUND", "Teacher document not found");
  }

  if (
    file.purpose !== "identity" &&
    file.purpose !== "qualification" &&
    file.purpose !== "intro_video"
  ) {
    throw new ApiError(400, "VALIDATION", "This file is not part of teacher verification");
  }

  await ensureDocumentReviews(file.ownerUserId);

  const [updated] = await db
    .update(teacherDocumentReviews)
    .set({
      status: input.status,
      note: input.note?.trim() || null,
      reviewedByUserId: actor.userId,
      reviewedAt: new Date(),
    })
    .where(eq(teacherDocumentReviews.fileId, fileId))
    .returning();

  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Document review not found");
  }

  if (input.status === "rejected" || input.status === "more_info") {
    if (
      file.verificationStatus !== "rejected" &&
      file.verificationStatus !== "suspended" &&
      file.verificationStatus !== "approved"
    ) {
      await db
        .update(teacherProfiles)
        .set({
          verificationStatus: "documents_pending",
          reviewNote:
            input.note?.trim() ||
            "A document needs attention before we can finish verification.",
        })
        .where(eq(teacherProfiles.userId, file.ownerUserId));

      await recordApplicationEvent({
        teacherUserId: file.ownerUserId,
        kind: "status_changed",
        fromStatus: file.verificationStatus,
        toStatus: "documents_pending",
        note: input.note,
        actorUserId: actor.userId,
      });
    }

    if (file.email) {
      await sendAccountEmail({
        to: file.email,
        subject:
          file.purpose === "intro_video"
            ? "Your introduction video needs an update"
            : "Teacher documents need an update",
        text:
          input.note?.trim() ||
          (file.purpose === "intro_video"
            ? "Staff asked you to replace your introduction video. Sign in to add a new YouTube, Vimeo, or https video link."
            : "Staff asked you to replace or add identity or qualification documents. Sign in to continue onboarding."),
      });
    }
  }

  await writeAuditLog({
    actor,
    action: "teachers.document_reviewed",
    entityType: "file",
    entityId: fileId,
    ipAddress: ip,
    metadata: {
      status: input.status,
      purpose: file.purpose,
      teacherUserId: file.ownerUserId,
    },
  });

  return { review: updated, teacherUserId: file.ownerUserId };
}
