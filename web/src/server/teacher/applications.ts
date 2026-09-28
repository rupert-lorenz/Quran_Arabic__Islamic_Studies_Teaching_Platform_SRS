import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  currencies,
  files,
  roles,
  teacherProfiles,
  teacherSubjects,
  users,
} from "@/db/schema";
import { getTeacherRateLimits, publicTeacherRate } from "./profile";
import {
  formatRateLimitView,
  listPricingControlRows,
  resolveTeacherRateBand,
} from "./pricing";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { sendAccountEmail } from "@/server/auth/mail";
import { destroyAllUserSessions } from "@/server/auth/session";
import {
  attachTeacherStats,
  getTeacherReviewAggregates,
} from "@/server/reviews/service";
import { listTeacherAgreementsForUsers } from "./agreement";
import { externalUrlFromStorageKey } from "./files";
import type { ReviewTeacherInput, TeacherDocumentType } from "./schemas";
import {
  ensureApplicationEvents,
  listApplicationEvents,
  listTeacherInterviews,
  publicInterview,
  recordApplicationEvent,
  requestTeacherInterview,
} from "./status";
import { videoWithPlayback } from "./video";
import {
  defaultDocumentType,
  documentChecklist,
  ensureDocumentReviews,
  listDocumentReviews,
} from "./verification";

export async function listTeacherApplications() {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      country: users.country,
      headline: teacherProfiles.headline,
      bio: teacherProfiles.bio,
      languages: teacherProfiles.languages,
      lessonsTaught: teacherProfiles.lessonsTaught,
      responseRate: teacherProfiles.responseRate,
      hourlyRateMinor: teacherProfiles.hourlyRateMinor,
      currencyCode: teacherProfiles.currencyCode,
      verificationStatus: teacherProfiles.verificationStatus,
      introVideoFileId: teacherProfiles.introVideoFileId,
      submittedAt: teacherProfiles.submittedAt,
      reviewedAt: teacherProfiles.reviewedAt,
      reviewNote: teacherProfiles.reviewNote,
      createdAt: teacherProfiles.createdAt,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(roles.key, "teacher"))
    .orderBy(desc(teacherProfiles.submittedAt), desc(teacherProfiles.createdAt));

  const userIds = rows.map((row) => row.userId);
  if (userIds.length === 0) {
    return [];
  }

  await Promise.all(
    userIds.map((userId, index) =>
      Promise.all([
        ensureDocumentReviews(userId),
        ensureApplicationEvents(userId, rows[index]!.verificationStatus),
      ]),
    ),
  );

  const [subjectRows, fileRows, agreementState, reviews, interviews, events, aggregates, currencyRows, limits, pricingRules] =
    await Promise.all([
    db
      .select({
        teacherUserId: teacherSubjects.teacherUserId,
        subjectSlug: teacherSubjects.subjectSlug,
      })
      .from(teacherSubjects)
      .where(inArray(teacherSubjects.teacherUserId, userIds)),
    db
      .select({
        id: files.id,
        ownerUserId: files.ownerUserId,
        purpose: files.purpose,
        originalName: files.originalName,
        mimeType: files.mimeType,
        byteSize: files.byteSize,
        storageKey: files.storageKey,
      })
      .from(files)
      .where(
        and(
          inArray(files.ownerUserId, userIds),
          inArray(files.purpose, ["identity", "qualification", "intro_video"]),
        ),
      ),
    listTeacherAgreementsForUsers(userIds, true),
    listDocumentReviews(userIds),
    listTeacherInterviews(userIds),
    listApplicationEvents(userIds),
    getTeacherReviewAggregates(userIds),
    db
      .select({
        code: currencies.code,
        symbol: currencies.symbol,
        decimalPlaces: currencies.decimalPlaces,
      })
      .from(currencies)
      .where(eq(currencies.isEnabled, true)),
    getTeacherRateLimits(),
    listPricingControlRows(),
  ]);

  const reviewByFile = new Map(reviews.map((item) => [item.fileId, item]));

  return Promise.all(rows.map(async (row) => {
    const documents = fileRows
      .filter(
        (item) =>
          item.ownerUserId === row.userId && item.purpose !== "intro_video",
      )
      .map((file) => publicStaffFile(file, reviewByFile.get(file.id)));
    const videoRow = row.introVideoFileId
      ? fileRows.find((item) => item.id === row.introVideoFileId)
      : fileRows.find(
          (item) =>
            item.ownerUserId === row.userId && item.purpose === "intro_video",
        );
    const video = videoRow
      ? videoWithPlayback(publicStaffFile(videoRow, reviewByFile.get(videoRow.id)))
      : null;

    const { introVideoFileId: _introVideoFileId, hourlyRateMinor, currencyCode, ...rest } = row;
    const agreements = agreementState.byUser.get(row.userId) ?? [];
    const currency = currencyRows.find((item) => item.code === currencyCode) ?? null;
    const [withStats] = attachTeacherStats([rest], aggregates);
    return {
      ...withStats,
      subjects: subjectRows
        .filter((item) => item.teacherUserId === row.userId)
        .map((item) => item.subjectSlug),
      documents,
      video,
      agreement: agreements.find((item) => item.current) ?? agreements[0] ?? null,
      agreements,
      agreementVersion: agreementState.current.version,
      checklist: documentChecklist({ documents, video }),
      interview:
        publicInterview(
          interviews.find((item) => item.teacherUserId === row.userId) ?? null,
        ),
      events: events
        .filter((item) => item.teacherUserId === row.userId)
        .slice(0, 12),
      rate: publicTeacherRate(
        hourlyRateMinor,
        currency,
        limits.commissionPercent,
        limits.commissionFixedMinor,
      ),
      rateLimits: formatRateLimitView(
        limits,
        await resolveTeacherRateBand(row.userId, limits, {
          country: row.country,
          subjectSlugs: subjectRows
            .filter((item) => item.teacherUserId === row.userId)
            .map((item) => item.subjectSlug),
          rules: pricingRules,
        }),
        pricingRules.find(
          (rule) => rule.scope === "teacher" && rule.scopeKey === row.userId,
        ) ?? null,
      ),
    };
  }));
}

export async function getTeacherApplication(userId: string) {
  const applications = await listTeacherApplications();
  const found = applications.find((item) => item.userId === userId);
  if (!found) {
    throw new ApiError(404, "NOT_FOUND", "Teacher application not found");
  }
  return found;
}

const applicationDecisionStatuses = [
  "application_started",
  "documents_pending",
  "under_review",
  "interview_required",
  "rejected",
] as const;

function locked(message: string): never {
  throw new ApiError(400, "LOCKED", message);
}

function requireDecisionNote(action: string, note: string | undefined) {
  if ((action === "reject" || action === "suspend") && !note?.trim()) {
    throw new ApiError(422, "VALIDATION", "Add a note for the teacher");
  }
}

export async function reviewTeacherApplication(
  actor: ApiActor,
  userId: string,
  input: ReviewTeacherInput,
  ip: string,
) {
  const [current] = await db
    .select({
      userId: users.id,
      email: users.email,
      verificationStatus: teacherProfiles.verificationStatus,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(eq(teacherProfiles.userId, userId))
    .limit(1);

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Teacher application not found");
  }

  const from = current.verificationStatus;
  requireDecisionNote(input.action, input.note);

  if (input.action === "approve" && from === "approved") {
    return getTeacherApplication(userId);
  }
  if (input.action === "reject" && from === "rejected") {
    return getTeacherApplication(userId);
  }
  if (input.action === "suspend" && from === "suspended") {
    return getTeacherApplication(userId);
  }
  if (input.action === "restore" && from === "approved") {
    return getTeacherApplication(userId);
  }

  if (input.action === "approve") {
    if (from === "suspended") {
      locked("Restore this teacher instead of approving again");
    }
    if (!(applicationDecisionStatuses as readonly string[]).includes(from)) {
      locked("This teacher cannot be approved from the current status");
    }
    const application = await getTeacherApplication(userId);
    if (!application.checklist.readyToApprove) {
      throw new ApiError(
        400,
        "INCOMPLETE",
        "Verify at least one identity document, one qualification, and the introduction video first",
      );
    }
  }

  if (input.action === "reject") {
    if (from === "approved") {
      locked("Suspend an approved teacher instead of rejecting the application");
    }
    if (from === "suspended") {
      locked("Restore this teacher before changing the application");
    }
    if (!(applicationDecisionStatuses as readonly string[]).includes(from)) {
      locked("This application cannot be rejected from the current status");
    }
  }

  if (input.action === "return_review") {
    if (
      from !== "interview_required" &&
      from !== "documents_pending" &&
      from !== "rejected"
    ) {
      locked(
        "Only interview, document-pending, or rejected applications can return to review",
      );
    }
  }

  if (input.action === "reopen" && from !== "rejected") {
    locked("Only rejected applications can be reopened");
  }

  if (input.action === "suspend" && from !== "approved") {
    locked("Only approved teachers can be suspended");
  }

  if (input.action === "restore" && from !== "suspended") {
    locked("Only suspended teachers can be restored");
  }

  if (input.action === "interview") {
    await requestTeacherInterview(actor, userId, { note: input.note }, ip);
    return getTeacherApplication(userId);
  }

  const nextVerification =
    input.action === "approve"
      ? "approved"
      : input.action === "reject"
        ? "rejected"
        : input.action === "suspend"
          ? "suspended"
          : input.action === "reopen"
            ? "documents_pending"
            : "under_review";
  const nextUserStatus =
    input.action === "approve" || input.action === "restore"
      ? "active"
      : input.action === "suspend"
        ? "suspended"
        : "pending";

  await db.transaction(async (tx) => {
    await tx
      .update(teacherProfiles)
      .set({
        verificationStatus: nextVerification,
        reviewedAt: new Date(),
        reviewNote: input.note?.trim() || null,
      })
      .where(eq(teacherProfiles.userId, userId));

    await tx
      .update(users)
      .set({ status: nextUserStatus })
      .where(eq(users.id, userId));
  });

  if (input.action === "suspend" || input.action === "reject") {
    await destroyAllUserSessions(userId);
  }

  const note = input.note?.trim();
  const messages = {
    approve: {
      subject: "Your teacher application was approved",
      text: "You can now teach on the platform. Sign in to finish setting your rate and availability.",
    },
    reject: {
      subject: "Your teacher application was not approved",
      text: `${note} Sign in, update anything staff asked for, and submit again.`,
    },
    return_review: {
      subject: "Your teacher application is under review again",
      text: note || "Staff moved your application back under review.",
    },
    reopen: {
      subject: "You can update your teacher application",
      text:
        note ||
        "Staff reopened your application. Sign in, update your documents, and submit again.",
    },
    suspend: {
      subject: "Your teacher account has been suspended",
      text: `${note} You cannot sign in or appear to families until staff restore the account.`,
    },
    restore: {
      subject: "Your teacher account has been restored",
      text:
        note ||
        "Your teacher account is active again. Sign in to continue teaching.",
    },
  } as const;

  const message =
    messages[input.action as Exclude<ReviewTeacherInput["action"], "interview">];
  await sendAccountEmail({
    to: current.email,
    subject: message.subject,
    text: message.text,
  });

  await recordApplicationEvent({
    teacherUserId: userId,
    kind: "status_changed",
    fromStatus: from,
    toStatus: nextVerification,
    note: input.note,
    actorUserId: actor.userId,
  });

  await writeAuditLog({
    actor,
    action: `teachers.application_${input.action}`,
    entityType: "teacher_profile",
    entityId: userId,
    ipAddress: ip,
    metadata: { note: input.note, from, to: nextVerification },
  });

  return getTeacherApplication(userId);
}

function publicStaffFile(
  file: {
    id: string;
    purpose: string;
    originalName: string | null;
    mimeType: string;
    byteSize: number;
    storageKey: string;
  },
  review?: {
    documentType: TeacherDocumentType;
    status: string;
    note: string | null;
  },
) {
  return {
    id: file.id,
    purpose: file.purpose,
    originalName: file.originalName,
    mimeType: file.mimeType,
    byteSize: file.byteSize,
    externalUrl: externalUrlFromStorageKey(file.storageKey),
    documentType:
      review?.documentType ??
      defaultDocumentType(file.purpose as "identity" | "qualification" | "intro_video"),
    reviewStatus: review?.status ?? "pending",
    reviewNote: review?.note ?? null,
  };
}
