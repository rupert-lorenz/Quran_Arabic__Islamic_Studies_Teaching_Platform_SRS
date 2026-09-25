import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  teacherApplicationEvents,
  teacherInterviews,
  teacherProfiles,
  users,
} from "@/db/schema";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { sendAccountEmail } from "@/server/auth/mail";
import type {
  ConfirmTeacherInterviewInput,
  RequestTeacherInterviewInput,
  UpdateTeacherInterviewInput,
} from "./schemas";

const openInterviewStatuses = ["requested", "scheduled", "confirmed"] as const;
type InterviewStatus = (typeof teacherInterviews.$inferSelect)["status"];
type VerificationStatus = (typeof teacherProfiles.$inferSelect)["verificationStatus"];
type EventKind = (typeof teacherApplicationEvents.$inferSelect)["kind"];

export async function recordApplicationEvent(input: {
  teacherUserId: string;
  kind: EventKind;
  fromStatus?: string | null;
  toStatus?: string | null;
  interviewId?: string | null;
  note?: string | null;
  actorUserId?: string | null;
}) {
  await db.insert(teacherApplicationEvents).values({
    teacherUserId: input.teacherUserId,
    kind: input.kind,
    fromStatus: (input.fromStatus as VerificationStatus | null) ?? null,
    toStatus: (input.toStatus as VerificationStatus | null) ?? null,
    interviewId: input.interviewId ?? null,
    note: input.note?.trim() || null,
    actorUserId: input.actorUserId ?? null,
  });
}

export async function ensureApplicationEvents(teacherUserId: string, status: string) {
  const [existing] = await db
    .select({ id: teacherApplicationEvents.id })
    .from(teacherApplicationEvents)
    .where(eq(teacherApplicationEvents.teacherUserId, teacherUserId))
    .limit(1);

  if (existing) {
    return;
  }

  await recordApplicationEvent({
    teacherUserId,
    kind: "status_changed",
    toStatus: status,
    note: "Existing application imported into the status timeline",
  });
}

export async function listApplicationEvents(teacherUserIds: string[]) {
  if (teacherUserIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: teacherApplicationEvents.id,
      teacherUserId: teacherApplicationEvents.teacherUserId,
      kind: teacherApplicationEvents.kind,
      fromStatus: teacherApplicationEvents.fromStatus,
      toStatus: teacherApplicationEvents.toStatus,
      interviewId: teacherApplicationEvents.interviewId,
      note: teacherApplicationEvents.note,
      createdAt: teacherApplicationEvents.createdAt,
    })
    .from(teacherApplicationEvents)
    .where(inArray(teacherApplicationEvents.teacherUserId, teacherUserIds))
    .orderBy(desc(teacherApplicationEvents.createdAt));
}

export async function listTeacherInterviews(teacherUserIds: string[]) {
  if (teacherUserIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: teacherInterviews.id,
      teacherUserId: teacherInterviews.teacherUserId,
      status: teacherInterviews.status,
      scheduledAt: teacherInterviews.scheduledAt,
      meetingUrl: teacherInterviews.meetingUrl,
      staffNote: teacherInterviews.staffNote,
      teacherNote: teacherInterviews.teacherNote,
      createdAt: teacherInterviews.createdAt,
      updatedAt: teacherInterviews.updatedAt,
    })
    .from(teacherInterviews)
    .where(inArray(teacherInterviews.teacherUserId, teacherUserIds))
    .orderBy(desc(teacherInterviews.createdAt));
}

export function publicInterview(
  interview: Awaited<ReturnType<typeof listTeacherInterviews>>[number] | null,
) {
  if (!interview) {
    return null;
  }

  return {
    id: interview.id,
    status: interview.status,
    scheduledAt: interview.scheduledAt,
    meetingUrl: interview.meetingUrl,
    staffNote: interview.staffNote,
    teacherNote: interview.teacherNote,
    open: openInterviewStatuses.includes(
      interview.status as (typeof openInterviewStatuses)[number],
    ),
  };
}

export async function requestTeacherInterview(
  actor: ApiActor,
  userId: string,
  input: RequestTeacherInterviewInput,
  ip: string,
) {
  const current = await requireTeacherAccount(userId);
  if (current.verificationStatus === "approved") {
    throw new ApiError(400, "LOCKED", "Approved teachers do not need an interview");
  }
  if (current.verificationStatus === "rejected" || current.verificationStatus === "suspended") {
    throw new ApiError(400, "LOCKED", "This application cannot be interviewed");
  }

  const interviews = await listTeacherInterviews([userId]);
  const open = interviews.find((item) =>
    openInterviewStatuses.includes(item.status as (typeof openInterviewStatuses)[number]),
  );
  const scheduledAt = parseInterviewTime(input.scheduledAt);
  const meetingUrl = normalizeMeetingUrl(input.meetingUrl);
  const nextStatus: InterviewStatus = scheduledAt ? "scheduled" : "requested";

  const [interview] = open
    ? await db
        .update(teacherInterviews)
        .set({
          status: nextStatus,
          scheduledAt,
          meetingUrl,
          staffNote: input.note?.trim() || open.staffNote,
        })
        .where(eq(teacherInterviews.id, open.id))
        .returning()
    : await db
        .insert(teacherInterviews)
        .values({
          teacherUserId: userId,
          status: nextStatus,
          scheduledAt,
          meetingUrl,
          staffNote: input.note?.trim() || null,
          requestedByUserId: actor.userId,
        })
        .returning();

  if (!interview) {
    throw new ApiError(500, "INTERNAL", "Could not save the interview");
  }

  await db
    .update(teacherProfiles)
    .set({
      verificationStatus: "interview_required",
      reviewedAt: new Date(),
      reviewNote: input.note?.trim() || current.reviewNote,
    })
    .where(eq(teacherProfiles.userId, userId));

  await recordApplicationEvent({
    teacherUserId: userId,
    kind: scheduledAt ? "interview_scheduled" : "interview_requested",
    fromStatus: current.verificationStatus,
    toStatus: "interview_required",
    interviewId: interview.id,
    note: input.note,
    actorUserId: actor.userId,
  });

  await sendAccountEmail({
    to: current.email,
    subject: scheduledAt
      ? "Your teacher interview is scheduled"
      : "Your teacher application needs an interview",
    text: interviewEmailText(interview.status, scheduledAt, meetingUrl, input.note),
  });

  await writeAuditLog({
    actor,
    action: scheduledAt ? "teachers.interview_scheduled" : "teachers.interview_requested",
    entityType: "teacher_interview",
    entityId: interview.id,
    ipAddress: ip,
    metadata: { teacherUserId: userId },
  });

  return interview;
}

export async function updateTeacherInterview(
  actor: ApiActor,
  interviewId: string,
  input: UpdateTeacherInterviewInput,
  ip: string,
) {
  const [interview] = await db
    .select({
      id: teacherInterviews.id,
      teacherUserId: teacherInterviews.teacherUserId,
      status: teacherInterviews.status,
      scheduledAt: teacherInterviews.scheduledAt,
      meetingUrl: teacherInterviews.meetingUrl,
      email: users.email,
      verificationStatus: teacherProfiles.verificationStatus,
    })
    .from(teacherInterviews)
    .innerJoin(users, eq(teacherInterviews.teacherUserId, users.id))
    .innerJoin(
      teacherProfiles,
      eq(teacherInterviews.teacherUserId, teacherProfiles.userId),
    )
    .where(eq(teacherInterviews.id, interviewId))
    .limit(1);

  if (!interview) {
    throw new ApiError(404, "NOT_FOUND", "Interview not found");
  }

  const scheduledAt =
    input.action === "schedule"
      ? parseInterviewTime(input.scheduledAt, true)
      : interview.scheduledAt;
  const meetingUrl =
    input.action === "schedule"
      ? normalizeMeetingUrl(input.meetingUrl, true)
      : interview.meetingUrl;

  const nextInterviewStatus: InterviewStatus =
    input.action === "schedule"
      ? "scheduled"
      : input.action === "complete"
        ? "completed"
        : input.action === "no_show"
          ? "no_show"
          : "cancelled";

  const nextVerification: VerificationStatus | undefined =
    input.action === "schedule" || input.action === "no_show"
      ? "interview_required"
      : input.action === "complete" || input.action === "cancel"
        ? "under_review"
        : undefined;

  await db
    .update(teacherInterviews)
    .set({
      status: nextInterviewStatus,
      scheduledAt,
      meetingUrl,
      staffNote: input.note?.trim() || null,
    })
    .where(eq(teacherInterviews.id, interviewId));

  if (nextVerification && nextVerification !== interview.verificationStatus) {
    await db
      .update(teacherProfiles)
      .set({
        verificationStatus: nextVerification,
        reviewedAt: new Date(),
        reviewNote: input.note?.trim() || null,
      })
      .where(eq(teacherProfiles.userId, interview.teacherUserId));
  }

  const eventKind: EventKind =
    input.action === "schedule"
      ? "interview_scheduled"
      : input.action === "complete"
        ? "interview_completed"
        : input.action === "no_show"
          ? "interview_no_show"
          : "interview_cancelled";

  await recordApplicationEvent({
    teacherUserId: interview.teacherUserId,
    kind: eventKind,
    fromStatus: interview.verificationStatus,
    toStatus: nextVerification ?? interview.verificationStatus,
    interviewId,
    note: input.note,
    actorUserId: actor.userId,
  });

  await sendAccountEmail({
    to: interview.email,
    subject:
      input.action === "schedule"
        ? "Your teacher interview is scheduled"
        : input.action === "complete"
          ? "Your teacher interview is complete"
          : input.action === "no_show"
            ? "We missed you at the teacher interview"
            : "Your teacher interview was cancelled",
    text: interviewEmailText(
      nextInterviewStatus,
      scheduledAt,
      meetingUrl,
      input.note,
    ),
  });

  await writeAuditLog({
    actor,
    action: `teachers.interview_${input.action}`,
    entityType: "teacher_interview",
    entityId: interviewId,
    ipAddress: ip,
    metadata: { teacherUserId: interview.teacherUserId },
  });

  return interview.teacherUserId;
}

export async function confirmTeacherInterview(actor: ApiActor, _input: ConfirmTeacherInterviewInput, ip: string) {
  const interviews = await listTeacherInterviews([actor.userId]);
  const open = interviews.find((item) => item.status === "scheduled");
  if (!open) {
    throw new ApiError(400, "VALIDATION", "There is no scheduled interview to confirm");
  }

  await db
    .update(teacherInterviews)
    .set({ status: "confirmed" })
    .where(eq(teacherInterviews.id, open.id));

  await recordApplicationEvent({
    teacherUserId: actor.userId,
    kind: "interview_confirmed",
    fromStatus: "interview_required",
    toStatus: "interview_required",
    interviewId: open.id,
    actorUserId: actor.userId,
  });

  await writeAuditLog({
    actor,
    action: "teachers.interview_confirmed",
    entityType: "teacher_interview",
    entityId: open.id,
    ipAddress: ip,
  });

  return open.id;
}

async function requireTeacherAccount(userId: string) {
  const [row] = await db
    .select({
      userId: users.id,
      email: users.email,
      verificationStatus: teacherProfiles.verificationStatus,
      reviewNote: teacherProfiles.reviewNote,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(eq(teacherProfiles.userId, userId))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Teacher application not found");
  }

  return row;
}

function parseInterviewTime(value?: string, required = false) {
  const trimmed = value?.trim();
  if (!trimmed) {
    if (required) {
      throw new ApiError(422, "VALIDATION", "Choose an interview date and time");
    }
    return null;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", "Enter a valid interview date and time");
  }
  return date;
}

function normalizeMeetingUrl(value?: string, required = false) {
  const trimmed = value?.trim();
  if (!trimmed) {
    if (required) {
      throw new ApiError(422, "VALIDATION", "Add an https meeting link");
    }
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ApiError(422, "VALIDATION", "Enter a valid https meeting link");
  }

  if (parsed.protocol !== "https:") {
    throw new ApiError(422, "VALIDATION", "Meeting links must use https");
  }

  return parsed.toString();
}

function interviewEmailText(
  status: string,
  scheduledAt: Date | null,
  meetingUrl: string | null,
  note?: string | null,
) {
  const when = scheduledAt
    ? `Time: ${scheduledAt.toUTCString()}.`
    : "Staff will send the time shortly.";
  const link = meetingUrl ? `Join: ${meetingUrl}` : "";
  const extra = note?.trim() || "";
  if (status === "completed") {
    return extra || "Thank you for attending. Staff will finish reviewing your application.";
  }
  if (status === "no_show") {
    return extra || "We could not reach you at the interview time. Staff will contact you to reschedule.";
  }
  if (status === "cancelled") {
    return extra || "The interview was cancelled. Your application is back under review.";
  }
  return [extra, when, link].filter(Boolean).join(" ");
}
