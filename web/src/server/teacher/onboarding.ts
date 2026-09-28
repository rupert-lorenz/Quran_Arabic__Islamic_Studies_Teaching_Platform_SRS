import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  countries,
  currencies,
  files,
  subjects,
  teacherAgreements,
  teacherDocumentReviews,
  teacherProfiles,
  teacherSubjects,
  users,
} from "@/db/schema";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { sendAccountEmail } from "@/server/auth/mail";
import { parseAudienceList } from "@/lib/teacher-search";
import {
  agreementContentHash,
  ensureCurrentAgreementVersion,
  getCurrentAgreementSignature,
  serializeClauses,
} from "./agreement";
import type {
  AddTeacherDocumentInput,
  AddTeacherVideoInput,
  SignTeacherAgreementInput,
  TeacherDocumentType,
  UpdateTeacherProfileInput,
} from "./schemas";
import {
  attachTeacherStats,
  getTeacherReviewAggregates,
} from "@/server/reviews/service";
import {
  getTeacherRateLimits,
  publicTeacherRate,
  writeTeacherProfileFields,
} from "./profile";
import {
  externalUrlFromStorageKey,
  teacherFileStorageKey,
} from "./files";
import {
  confirmTeacherInterview as confirmInterviewRecord,
  listApplicationEvents,
  listTeacherInterviews,
  publicInterview,
  recordApplicationEvent,
} from "./status";
import { requireIntroVideoUrl, videoWithPlayback } from "./video";
import {
  assertDocumentTypeForPurpose,
  createPendingDocumentReview,
  defaultDocumentType,
  documentChecklist,
  ensureDocumentReviews,
  listDocumentReviews,
} from "./verification";

const editableStatuses = [
  "application_started",
  "documents_pending",
  "interview_required",
  "rejected",
] as const;

const documentEditableStatuses = [
  ...editableStatuses,
  "under_review",
] as const;

export function teacherNeedsOnboarding(status: string) {
  return status !== "approved";
}

export async function getTeacherVerificationStatus(userId: string) {
  const [row] = await db
    .select({ verificationStatus: teacherProfiles.verificationStatus })
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, userId))
    .limit(1);
  return row?.verificationStatus ?? null;
}

export async function getOnboardingState(userId: string) {
  const [profile] = await db
    .select({
      userId: teacherProfiles.userId,
      headline: teacherProfiles.headline,
      bio: teacherProfiles.bio,
      languages: teacherProfiles.languages,
      gender: teacherProfiles.gender,
      audiences: teacherProfiles.audiences,
      lessonsTaught: teacherProfiles.lessonsTaught,
      responseRate: teacherProfiles.responseRate,
      hourlyRateMinor: teacherProfiles.hourlyRateMinor,
      currencyCode: teacherProfiles.currencyCode,
      verificationStatus: teacherProfiles.verificationStatus,
      introVideoFileId: teacherProfiles.introVideoFileId,
      submittedAt: teacherProfiles.submittedAt,
      reviewedAt: teacherProfiles.reviewedAt,
      reviewNote: teacherProfiles.reviewNote,
      country: users.country,
      displayName: users.displayName,
      email: users.email,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(eq(teacherProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    throw new ApiError(404, "NOT_FOUND", "Teacher application not found");
  }

  await ensureDocumentReviews(userId);

  const [subjectRows, documentRows, agreementState, catalog, countryRows, reviews, interviews, events, aggregates] =
    await Promise.all([
      db
        .select({ slug: teacherSubjects.subjectSlug })
        .from(teacherSubjects)
        .where(eq(teacherSubjects.teacherUserId, userId)),
      db
        .select({
          id: files.id,
          purpose: files.purpose,
          originalName: files.originalName,
          mimeType: files.mimeType,
          byteSize: files.byteSize,
          storageKey: files.storageKey,
          createdAt: files.createdAt,
        })
        .from(files)
        .where(
          and(
            eq(files.ownerUserId, userId),
            inArray(files.purpose, ["identity", "qualification", "intro_video"]),
          ),
        )
        .orderBy(desc(files.createdAt)),
      getCurrentAgreementSignature(userId),
      db
        .select({
          slug: subjects.slug,
          name: subjects.name,
        })
        .from(subjects)
        .where(eq(subjects.isEnabled, true))
        .orderBy(subjects.sortOrder),
      db
        .select({
          iso2: countries.iso2,
          name: countries.name,
        })
        .from(countries)
        .where(eq(countries.isEnabled, true))
        .orderBy(countries.sortOrder),
      listDocumentReviews([userId]),
      listTeacherInterviews([userId]),
      listApplicationEvents([userId]),
      getTeacherReviewAggregates([userId]),
    ]);

  const reviewByFile = new Map(reviews.map((item) => [item.fileId, item]));
  const documents = documentRows
    .filter((item) => item.purpose !== "intro_video")
    .map((file) => publicFile(file, reviewByFile.get(file.id)));
  const videoRow =
    documentRows.find((item) => item.id === profile.introVideoFileId) ?? null;
  const video = videoRow ? publicFile(videoRow, reviewByFile.get(videoRow.id)) : null;
  const hasLiveDocument = (purpose: "identity" | "qualification") =>
    documents.some(
      (item) =>
        item.purpose === purpose &&
        (item.reviewStatus === "pending" || item.reviewStatus === "verified"),
    );

  const steps = {
    profile: Boolean(
      profile.headline &&
        profile.bio &&
        profile.languages &&
        profile.country &&
        subjectRows.length > 0,
    ),
    documents: hasLiveDocument("identity") && hasLiveDocument("qualification"),
    video: Boolean(
      video &&
        (video.reviewStatus === "pending" || video.reviewStatus === "verified"),
    ),
    agreement: Boolean(agreementState.agreement),
  };

  return {
    displayName: profile.displayName,
    email: profile.email,
    verificationStatus: profile.verificationStatus,
    reviewNote: profile.reviewNote,
    submittedAt: profile.submittedAt,
    reviewedAt: profile.reviewedAt,
    canEdit: editableStatuses.includes(
      profile.verificationStatus as (typeof editableStatuses)[number],
    ),
    canEditDocuments: documentEditableStatuses.includes(
      profile.verificationStatus as (typeof documentEditableStatuses)[number],
    ),
    canEditVideo:
      editableStatuses.includes(
        profile.verificationStatus as (typeof editableStatuses)[number],
      ) || profile.verificationStatus === "approved",
    canSignAgreement:
      profile.verificationStatus !== "suspended" && !agreementState.agreement,
    profile: {
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
      languages: profile.languages ?? "",
      country: profile.country ?? "",
      gender: profile.gender ?? "",
      audienceSlugs: parseAudienceList(profile.audiences),
      subjectSlugs: subjectRows.map((item) => item.slug),
    },
    documents,
    video: video ? videoWithPlayback(video) : null,
    agreement: agreementState.agreement,
    agreements: agreementState.records,
    interview: publicInterview(interviews[0] ?? null),
    events: events.slice(0, 12),
    agreementVersion: agreementState.current.version,
    agreementTitle: agreementState.current.title,
    agreementClauses: agreementState.current.clauses,
    steps,
    readyToSubmit: Object.values(steps).every(Boolean),
    catalog,
    countries: countryRows,
    lessonsTaught: profile.lessonsTaught,
    responseRate: profile.responseRate,
    hourlyRateMinor: profile.hourlyRateMinor,
    currencyCode: profile.currencyCode,
    stats: attachTeacherStats(
      [
        {
          userId,
          lessonsTaught: profile.lessonsTaught,
          responseRate: profile.responseRate,
        },
      ],
      aggregates,
    )[0]!.stats,
  };
}

export async function getTeacherVerificationSummary(userId: string) {
  const state = await getOnboardingState(userId);
  const verification = documentChecklist({
    documents: state.documents,
    video: state.video,
  });
  const videoAwaitingReview =
    state.verificationStatus === "approved" &&
    state.video?.reviewStatus === "pending";

  return {
    displayName: state.displayName,
    email: state.email,
    verificationStatus: state.verificationStatus,
    reviewNote: state.reviewNote,
    submittedAt: state.submittedAt,
    reviewedAt: state.reviewedAt,
    videoAwaitingReview,
    steps: state.steps,
    readyToSubmit: state.readyToSubmit,
    verification: {
      ...verification,
      agreementCurrent: Boolean(state.agreement),
    },
    interview: state.interview,
    events: state.events ?? [],
    lessonsTaught: state.lessonsTaught,
    responseRate: state.responseRate,
    stats: state.stats,
    rate:
      state.verificationStatus === "approved"
        ? await loadTeacherRateSplit(state.hourlyRateMinor, state.currencyCode)
        : null,
  };
}

async function loadTeacherRateSplit(
  hourlyRateMinor: number | null,
  currencyCode: string | null,
) {
  const [limits, currencyRows] = await Promise.all([
    getTeacherRateLimits(),
    db
      .select({
        code: currencies.code,
        symbol: currencies.symbol,
        decimalPlaces: currencies.decimalPlaces,
      })
      .from(currencies)
      .where(eq(currencies.isEnabled, true)),
  ]);
  const currency =
    currencyRows.find((item) => item.code === currencyCode) ??
    currencyRows.find((item) => item.code === limits.defaultCurrencyCode) ??
    currencyRows[0];
  return publicTeacherRate(
    hourlyRateMinor,
    currency,
    limits.commissionPercent,
    limits.commissionFixedMinor,
  );
}

export async function updateTeacherProfile(
  actor: ApiActor,
  input: UpdateTeacherProfileInput,
  ip: string,
) {
  const state = await requireEditableApplication(actor.userId);
  await writeTeacherProfileFields(actor.userId, input);

  if (state.verificationStatus === "application_started") {
    await db
      .update(teacherProfiles)
      .set({ verificationStatus: "documents_pending" })
      .where(eq(teacherProfiles.userId, actor.userId));
  }

  await writeAuditLog({
    actor,
    action: "teachers.profile_updated",
    entityType: "teacher_profile",
    entityId: actor.userId,
    ipAddress: ip,
  });

  return getOnboardingState(actor.userId);
}

export async function addTeacherDocument(
  actor: ApiActor,
  input: AddTeacherDocumentInput,
  ip: string,
) {
  await requireDocumentEditableApplication(actor.userId);
  assertDocumentTypeForPurpose(input.purpose, input.documentType);
  const created = await insertTeacherFile(actor.userId, {
    purpose: input.purpose,
    documentType: input.documentType,
    originalName: input.originalName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    externalUrl: input.externalUrl,
  });

  await writeAuditLog({
    actor,
    action: "teachers.document_added",
    entityType: "file",
    entityId: created.id,
    ipAddress: ip,
    metadata: { purpose: input.purpose, documentType: input.documentType },
  });

  return getOnboardingState(actor.userId);
}

export async function removeTeacherDocument(
  actor: ApiActor,
  fileId: string,
  ip: string,
) {
  const state = await requireDocumentEditableApplication(actor.userId);
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.ownerUserId, actor.userId)))
    .limit(1);

  if (!file || (file.purpose !== "identity" && file.purpose !== "qualification")) {
    throw new ApiError(404, "NOT_FOUND", "Document not found");
  }

  if (state.introVideoFileId === file.id) {
    throw new ApiError(400, "VALIDATION", "That file is the introduction video");
  }

  const [review] = await db
    .select({ status: teacherDocumentReviews.status })
    .from(teacherDocumentReviews)
    .where(eq(teacherDocumentReviews.fileId, fileId))
    .limit(1);

  if (review?.status === "verified") {
    throw new ApiError(400, "LOCKED", "Verified documents cannot be removed");
  }

  await db.delete(files).where(eq(files.id, fileId));
  await writeAuditLog({
    actor,
    action: "teachers.document_removed",
    entityType: "file",
    entityId: fileId,
    ipAddress: ip,
  });

  return getOnboardingState(actor.userId);
}

export async function setTeacherVideo(
  actor: ApiActor,
  input: AddTeacherVideoInput,
  ip: string,
) {
  const profile = await requireVideoEditableApplication(actor.userId);
  const playback = requireIntroVideoUrl(input.externalUrl);
  const current = await getOnboardingState(actor.userId);
  if (current.video?.externalUrl === playback.watchUrl) {
    return current;
  }

  const created = await insertTeacherFile(actor.userId, {
    purpose: "intro_video",
    documentType: "other",
    originalName: input.originalName ?? "Introduction video",
    mimeType: input.mimeType ?? `video/${playback.provider}`,
    byteSize: input.byteSize ?? 0,
    externalUrl: playback.watchUrl,
  });

  await db
    .update(teacherProfiles)
    .set({ introVideoFileId: created.id })
    .where(eq(teacherProfiles.userId, actor.userId));

  if (profile.verificationStatus === "approved") {
    await sendAccountEmail({
      to: current.email,
      subject: "Your introduction video is under review",
      text: "Families will keep seeing your last verified introduction until staff approve the new video.",
    });
  }

  await writeAuditLog({
    actor,
    action: "teachers.video_updated",
    entityType: "file",
    entityId: created.id,
    ipAddress: ip,
    metadata: { provider: playback.provider, approved: profile.verificationStatus === "approved" },
  });

  return getOnboardingState(actor.userId);
}

export async function signTeacherAgreement(
  actor: ApiActor,
  input: SignTeacherAgreementInput,
  meta: { ip: string; userAgent: string },
) {
  const state = await getOnboardingState(actor.userId);
  if (!state.canSignAgreement) {
    if (state.agreement) {
      return state;
    }
    throw new ApiError(400, "LOCKED", "This agreement cannot be signed now");
  }

  const current = await ensureCurrentAgreementVersion();
  const acceptedAt = new Date();
  const contentHash = agreementContentHash({
    version: current.version,
    title: current.title,
    clauses: current.clauses,
    teacherUserId: actor.userId,
    signatureName: input.signatureName,
    acceptedAt,
  });

  const [created] = await db
    .insert(teacherAgreements)
    .values({
      teacherUserId: actor.userId,
      version: current.version,
      title: current.title,
      clauseSnapshot: serializeClauses(current.clauses),
      contentHash,
      signatureName: input.signatureName,
      ipAddress: meta.ip,
      userAgent: meta.userAgent.slice(0, 512),
      acceptedAt,
    })
    .onConflictDoNothing({
      target: [teacherAgreements.teacherUserId, teacherAgreements.version],
    })
    .returning();

  if (created) {
    await recordApplicationEvent({
      teacherUserId: actor.userId,
      kind: "agreement_signed",
      note: `Signed ${current.version}`,
      actorUserId: actor.userId,
    });
    await writeAuditLog({
      actor,
      action: "teachers.agreement_signed",
      entityType: "teacher_agreement",
      entityId: created.id,
      ipAddress: meta.ip,
      metadata: { version: current.version, contentHash },
    });
  }

  return getOnboardingState(actor.userId);
}

export async function submitTeacherApplication(actor: ApiActor, ip: string) {
  const state = await getOnboardingState(actor.userId);
  if (!state.canEdit) {
    throw new ApiError(400, "LOCKED", "This application cannot be edited");
  }
  if (!state.readyToSubmit) {
    throw new ApiError(
      400,
      "INCOMPLETE",
      "Finish your profile, documents, video, and agreement first",
    );
  }

  await db
    .update(teacherProfiles)
    .set({
      verificationStatus: "under_review",
      submittedAt: new Date(),
    })
    .where(eq(teacherProfiles.userId, actor.userId));

  await sendAccountEmail({
    to: state.email,
    subject: "Your teacher application is under review",
    text: "We have received your teacher application. Staff will review your documents and introduction video.",
  });

  await recordApplicationEvent({
    teacherUserId: actor.userId,
    kind: "submitted",
    fromStatus: state.verificationStatus,
    toStatus: "under_review",
    actorUserId: actor.userId,
  });

  await writeAuditLog({
    actor,
    action: "teachers.application_submitted",
    entityType: "teacher_profile",
    entityId: actor.userId,
    ipAddress: ip,
  });

  return getOnboardingState(actor.userId);
}

export async function confirmTeacherInterview(actor: ApiActor, ip: string) {
  await confirmInterviewRecord(actor, { confirmed: true }, ip);
  return getOnboardingState(actor.userId);
}

async function requireVideoEditableApplication(userId: string) {
  const row = await requireTeacherProfile(userId);
  if (
    row.verificationStatus === "approved" ||
    editableStatuses.includes(
      row.verificationStatus as (typeof editableStatuses)[number],
    )
  ) {
    return row;
  }

  throw new ApiError(400, "LOCKED", "This introduction video cannot be changed");
}

async function requireTeacherProfile(userId: string) {
  const [row] = await db
    .select()
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, userId))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Teacher application not found");
  }

  return row;
}

async function requireEditableApplication(userId: string) {
  const row = await requireTeacherProfile(userId);

  if (
    !editableStatuses.includes(
      row.verificationStatus as (typeof editableStatuses)[number],
    )
  ) {
    throw new ApiError(400, "LOCKED", "This application cannot be edited");
  }

  return row;
}

async function requireDocumentEditableApplication(userId: string) {
  const row = await requireTeacherProfile(userId);

  if (
    !documentEditableStatuses.includes(
      row.verificationStatus as (typeof documentEditableStatuses)[number],
    )
  ) {
    throw new ApiError(
      400,
      "LOCKED",
      "Identity and qualification documents cannot be changed on this application",
    );
  }

  return row;
}

async function insertTeacherFile(
  userId: string,
  input: {
    purpose: "identity" | "qualification" | "intro_video";
    documentType: TeacherDocumentType;
    originalName: string;
    mimeType: string;
    byteSize: number;
    externalUrl?: string;
  },
) {
  const originalName = input.originalName.replace(/[/\\]/g, "").slice(0, 255);
  const externalUrl = normalizeExternalUrl(input.externalUrl, {
    allowHttp: input.purpose !== "intro_video",
  });
  const storageKey = teacherFileStorageKey(
    userId,
    input.purpose,
    originalName,
    externalUrl,
  );

  const [created] = await db
    .insert(files)
    .values({
      ownerUserId: userId,
      purpose: input.purpose,
      storageKey,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      originalName,
      visibility: "restricted",
    })
    .returning();

  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not record the file");
  }

  await createPendingDocumentReview(userId, created.id, input.documentType);
  return created;
}

function normalizeExternalUrl(
  value?: string,
  options?: { allowHttp?: boolean },
) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ApiError(422, "VALIDATION", "Enter a valid http or https link");
  }

  const allowHttp = options?.allowHttp !== false;
  if (parsed.protocol === "https:") {
    return parsed.toString();
  }
  if (allowHttp && parsed.protocol === "http:") {
    return parsed.toString();
  }

  throw new ApiError(
    422,
    "VALIDATION",
    allowHttp
      ? "Document links must use http or https"
      : "Document and video links must use https",
  );
}

function publicFile(
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
