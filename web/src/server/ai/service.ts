import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  aiJobs,
  aiTranscripts,
  bookings,
  classroomFiles,
  classroomMessages,
  classroomParticipants,
  classrooms,
  fileObjects,
  files,
  groupLessonEnrollments,
  parentChildren,
  questionBankItems,
  recordings,
  teachingMaterials,
  users,
} from "@/db/schema";
import {
  aiContentIsIdentified,
  aiJobIsPendingReview,
  aiKindRequiresReview,
  isAcademicAiKind,
  payloadAiOrigin,
  resolveAiContentOrigin,
  type AiAcademicKind,
  type AiContentOrigin,
  aiProgressHref,
  countTranscriptQueryMatches,
  detectAiLocale,
  distinctTranscriptSpeakers,
  genericSpeakerName,
  normaliseArabicTranscript,
  normaliseEnglishTranscript,
  parseTypedImprovementAreas,
  parseTypedKeyPoints,
  parseTypedNextLessonRecommendations,
  parseTypedHomework,
  parseTypedNotes,
  parseTypedQuiz,
  parseTypedRecommendation,
  parseTypedVocabulary,
  payloadImprovementAreas,
  payloadKeyPoints,
  payloadNextLessonRecommendations,
  payloadHomeworkBody,
  payloadHomeworkTasks,
  payloadHomeworkTitle,
  payloadQuizBody,
  payloadQuizFileName,
  payloadQuizPreviousTitle,
  payloadQuizQuestions,
  payloadRecommendationBody,
  payloadRecommendationFocus,
  payloadRecommendationItems,
  payloadRecommendationPreviousTitle,
  payloadRecommendationTitle,
  payloadQuizSource,
  payloadQuizTitle,
  payloadQuizTopic,
  hideQuizAnswers,
  payloadNotesBody,
  payloadNotesBullets,
  payloadVocabulary,
  payloadSummaryBody,
  payloadSummaryTranscriptJobId,
  prepareTranscriptSegments,
  sameTranscriptSegment,
  segmentsFromTypedBody,
  speakerRoleFromActor,
  sortTranscriptSegments,
  transcriptSearchPattern,
  isAiJobStatus,
  isAiLocale,
  isAiSpeakerRole,
  isAiTranscriptSource,
  type AiJobStatus,
  type AiLocale,
  type AiQuizQuestionDraft,
  type AiQuizSource,
  type AiSpeakerRole,
  type AiSpeakerView,
  type AiTranscriptSegment,
  type AiTranscriptSource,
} from "@/lib/ai-systems";
import { runAiModule } from "@/server/ai/adapter";
import {
  assertAiActionModule,
  assertAiModuleLive,
  getAiArchitecture,
  listLiveAiCapabilityModules,
  listPlannedAiModules,
  type AiArchitectureView,
  type AiModuleView,
} from "@/server/ai/registry";
import {
  payloadSupportBody,
  payloadSupportHits,
  payloadSupportQuery,
  platformSupportSources,
  type AiSupportHit,
} from "@/lib/ai-support";
import { listPublishedCmsForLocale } from "@/server/cms/public";
import {
  AI_UPLOAD_MAX_BYTES,
  extractUploadedDocumentText,
  resolveAiUploadType,
  sanitizeAiUploadName,
} from "@/lib/ai-uploads";
import {
  AI_FORBIDDEN_AUTONOMOUS_DECISIONS,
  aiDecisionPayload,
  collectDecisionScanText,
  refuseAutonomousSensitiveDecision,
  type AiForbiddenDecision,
} from "@/lib/ai-decisions";
import {
  AI_SAFETY_CONTROLS,
  aiSafetyPayload,
  prepareAiSafeText,
  type AiSafetyControl,
} from "@/lib/ai-safety";
import { classroomContainsContactDetails } from "@/lib/classroom";
import { isLibraryBookCategory, LIBRARY_BOOK_CATEGORIES } from "@/lib/library-materials";
import { bankItemToQuizQuestion } from "@/lib/question-bank";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import { writeAuditLog } from "@/server/api/audit";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { actorCanViewClassroomRecordings } from "@/server/classroom/recording-access";
import { assertParentOwnsChild } from "@/server/parent/children";

export type { AiArchitectureView, AiModuleView };

export type AiClassroomOption = {
  id: string;
  title: string;
  subjectSlug: string;
  recordingId: string | null;
  recordingReady: boolean;
};

export type AiTranscriptView = {
  id: string;
  jobId: string;
  classroomId: string;
  classroomTitle: string;
  recordingId: string | null;
  locale: AiLocale;
  status: AiJobStatus;
  source: AiTranscriptSource;
  generatedByAi: boolean;
  origin: AiContentOrigin;
  speakerCount: number;
  identifiedSpeakerCount: number;
  speakers: AiSpeakerView[];
  fullText: string;
  segments: AiTranscriptSegment[];
  matchCount: number;
  matchedIndexes: number[];
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
};

export type AiSummaryView = {
  id: string;
  classroomId: string;
  classroomTitle: string;
  transcriptJobId: string | null;
  locale: AiLocale;
  status: AiJobStatus;
  generatedByAi: boolean;
  origin: AiContentOrigin;
  body: string;
  sentenceCount: number;
  keyPoints: string[];
  vocabulary: string[];
  improvementAreas: string[];
  nextLessonRecommendations: string[];
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
};

export type AiNoteView = {
  id: string;
  classroomId: string;
  classroomTitle: string;
  transcriptJobId: string | null;
  locale: AiLocale;
  status: AiJobStatus;
  generatedByAi: boolean;
  origin: AiContentOrigin;
  body: string;
  bullets: string[];
  createdAt: string;
};

export type AiHomeworkView = {
  id: string;
  classroomId: string;
  classroomTitle: string;
  transcriptJobId: string | null;
  locale: AiLocale;
  status: AiJobStatus;
  generatedByAi: boolean;
  origin: AiContentOrigin;
  title: string;
  body: string;
  tasks: string[];
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
};

export type AiBookOption = {
  id: string;
  title: string;
  category: string;
};

export type AiTopicOption = {
  topic: string;
  count: number;
};

export type AiUploadOption = {
  id: string;
  name: string;
  classroomId?: string | null;
  classroomTitle?: string;
};

export type AiPreviousLessonOption = {
  id: string;
  title: string;
  locale: AiLocale;
};

export type AiQuizView = {
  id: string;
  classroomId: string;
  classroomTitle: string;
  source: AiQuizSource;
  sourceLabel: string;
  transcriptJobId: string | null;
  locale: AiLocale;
  status: AiJobStatus;
  generatedByAi: boolean;
  origin: AiContentOrigin;
  title: string;
  body: string;
  questions: AiQuizQuestionDraft[];
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
};

export type AiRecommendationView = {
  id: string;
  classroomId: string;
  classroomTitle: string;
  sourceLabel: string;
  transcriptJobId: string | null;
  locale: AiLocale;
  status: AiJobStatus;
  generatedByAi: boolean;
  origin: AiContentOrigin;
  title: string;
  body: string;
  items: string[];
  focus: string[];
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
};

export type AiReviewItem = {
  jobId: string;
  kind: AiAcademicKind;
  classroomId: string;
  classroomTitle: string;
  locale: AiLocale;
  status: AiJobStatus;
  generatedByAi: boolean;
  origin: AiContentOrigin;
  title: string;
  excerpt: string;
  createdAt: string;
};

export type AiSupportView = {
  id: string;
  query: string;
  locale: AiLocale;
  status: AiJobStatus;
  generatedByAi: boolean;
  origin: AiContentOrigin;
  body: string;
  hits: AiSupportHit[];
  createdAt: string;
};

export type AiSystemsDesk = {
  href: string;
  canEdit: boolean;
  canWriteNotes: boolean;
  query: string;
  studentUserId?: string;
  language: AiLocale | "all";
  englishLive: true;
  arabicLive: true;
  searchableLive: true;
  speakersLive: true;
  summariesLive: true;
  keyPointsLive: true;
  vocabularyLive: true;
  improvementAreasLive: true;
  nextLessonRecommendationsLive: true;
  notesLive: true;
  homeworkLive: true;
  quizLive: true;
  recommendationsLive: true;
  reviewLive: true;
  identificationLive: true;
  decisionsLive: true;
  architectureLive: true;
  architecture: AiArchitectureView;
  supportLive: true;
  supports: AiSupportView[];
  actorUserId: string;
  actorName: string;
  actorRole: AiSpeakerRole;
  safety: {
    labelled: true;
    noAutonomousAcademic: true;
    noAutonomousSafeguarding: true;
    reviewRequired: true;
    contactBlocked: true;
    paymentHidden: true;
    extractiveOnly: true;
    controlsLive: true;
    controls: AiSafetyControl[];
  };
  decisions: {
    live: true;
    autonomous: false;
    academicBlocked: true;
    safeguardingBlocked: true;
    forbidden: AiForbiddenDecision[];
  };
  modules: AiModuleView[];
  classrooms: AiClassroomOption[];
  transcripts: AiTranscriptView[];
  summaries: AiSummaryView[];
  notes: AiNoteView[];
  homeworks: AiHomeworkView[];
  quizzes: AiQuizView[];
  recommendations: AiRecommendationView[];
  books: AiBookOption[];
  topics: AiTopicOption[];
  uploads: AiUploadOption[];
  previousLessons: AiPreviousLessonOption[];
  reviewQueue: AiReviewItem[];
};

const STAFF_AI_PERMISSIONS = [
  "academic.curriculum",
  "academic.certificates",
  "reports.academic",
  "classes.manage",
  "safeguarding.recordings",
] as const;

function isStaffAcademic(actor: ApiActor) {
  return isStaffRole(actor.roleKey) && hasAnyPermission(actor, STAFF_AI_PERMISSIONS);
}

function canEditAi(actor: ApiActor) {
  return actor.roleKey === "teacher" || isStaffAcademic(actor);
}

function unpublishedAcademicFields() {
  return {
    reviewedByUserId: null,
    reviewedAt: null,
    publishedAt: null,
  };
}

function requireAiSafeText(text: string, mode: "reject" | "filter") {
  const result = prepareAiSafeText(text, mode);
  if (!result.ok) {
    throw new ApiError(
      422,
      result.scan.contactBlocked ? "CONTACT_BLOCKED" : "AI_SAFETY",
      result.reason,
    );
  }
  return result;
}

function quizQuestionSafetyFields(item: AiQuizQuestionDraft) {
  return [item.prompt, ...(item.accepted ?? []), ...(item.choices ?? [])];
}

function requireAiSafeFields(fields: string[], mode: "reject" | "filter") {
  let filtered = false;
  const texts = fields.map((field) => {
    const result = requireAiSafeText(field, mode);
    filtered = filtered || result.filtered;
    return result.text;
  });
  return { texts, filtered };
}

function safeTranscriptSegments(
  segments: AiTranscriptSegment[],
  mode: "reject" | "filter",
) {
  let filtered = false;
  const next: AiTranscriptSegment[] = [];
  for (const segment of segments) {
    const result = requireAiSafeText(segment.body, mode);
    if (!result.text.trim()) {
      filtered = filtered || result.filtered;
      continue;
    }
    filtered = filtered || result.filtered;
    next.push({ ...segment, body: result.text });
  }
  if (!next.length) {
    throw new ApiError(
      422,
      "AI_SAFETY",
      "No safe lesson text remains after AI safety controls",
    );
  }
  return { segments: next, filtered };
}

function applyAiIdentification(
  payload: Record<string, unknown>,
  nowGeneratedByAi: boolean,
  existing?: { generatedByAi: boolean; payload: Record<string, unknown> | null } | null,
) {
  const origin = resolveAiContentOrigin({
    nowGeneratedByAi,
    previousOrigin: existing
      ? payloadAiOrigin(existing.payload, existing.generatedByAi)
      : undefined,
  });
  return {
    origin,
    generatedByAi: aiContentIsIdentified(origin),
    payload: {
      ...payload,
      identification: {
        origin,
        labelled: aiContentIsIdentified(origin),
      },
    },
  };
}

function viewOrigin(job: typeof aiJobs.$inferSelect): AiContentOrigin {
  return payloadAiOrigin(job.payload, job.generatedByAi);
}

function reviewExcerpt(text: string) {
  const body = text.replace(/\s+/g, " ").trim();
  if (body.length <= 180) return body;
  return `${body.slice(0, 177)}…`;
}

function academicJobHasPublishableContent(
  job: typeof aiJobs.$inferSelect,
  transcriptText?: string,
) {
  if (job.kind === "transcription") {
    return (transcriptText ?? "").replace(/\s+/g, " ").trim().length >= 2;
  }
  if (job.kind === "summary") {
    return payloadSummaryBody(job.payload).trim().length >= 20;
  }
  if (job.kind === "homework") {
    return (
      payloadHomeworkBody(job.payload).trim().length >= 20 ||
      payloadHomeworkTasks(job.payload).length > 0
    );
  }
  if (job.kind === "quiz") {
    return payloadQuizQuestions(job.payload).length > 0;
  }
  if (job.kind === "recommendation") {
    return (
      payloadRecommendationItems(job.payload).length > 0 ||
      payloadRecommendationBody(job.payload).trim().length >= 20
    );
  }
  return false;
}

function canWriteNotes(actor: ApiActor) {
  return (
    actor.roleKey === "student" ||
    actor.roleKey === "teacher" ||
    isStaffAcademic(actor)
  );
}

function canCaptureSpeech(actor: ApiActor) {
  return (
    actor.roleKey === "teacher" ||
    actor.roleKey === "student" ||
    isStaffAcademic(actor)
  );
}

function aiPath(actor: ApiActor, studentUserId?: string) {
  return aiProgressHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffAcademic(actor),
    studentUserId,
  );
}

async function parentChildIds(parentUserId: string) {
  return (
    await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(eq(parentChildren.parentUserId, parentUserId))
  ).map((row) => row.id);
}

async function assertCanViewStudent(actor: ApiActor, studentUserId: string) {
  if (actor.roleKey === "student" && actor.userId === studentUserId) return;
  if (actor.roleKey === "parent") {
    await assertParentOwnsChild(actor.userId, studentUserId);
    return;
  }
  if (isStaffAcademic(actor)) return;
  if (actor.roleKey === "teacher") return;
  throw new ApiError(403, "FORBIDDEN", "You cannot view this AI desk");
}

async function visibleClassroomIds(
  actor: ApiActor,
  studentUserId?: string,
): Promise<string[]> {
  if (isStaffAcademic(actor)) {
    const rows = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .orderBy(desc(classrooms.updatedAt))
      .limit(80);
    return rows.map((row) => row.id);
  }
  if (actor.roleKey === "teacher") {
    const rows = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(eq(classrooms.teacherUserId, actor.userId))
      .orderBy(desc(classrooms.updatedAt))
      .limit(80);
    return rows.map((row) => row.id);
  }
  const studentIds =
    actor.roleKey === "parent"
      ? studentUserId
        ? [studentUserId]
        : await parentChildIds(actor.userId)
      : actor.roleKey === "student"
        ? [actor.userId]
        : [];
  if (!studentIds.length) return [];
  const [bookingRows, enrollmentRows, participantRows] = await Promise.all([
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(inArray(bookings.studentUserId, studentIds)),
    db
      .select({ groupLessonId: groupLessonEnrollments.groupLessonId })
      .from(groupLessonEnrollments)
      .where(
        and(
          inArray(groupLessonEnrollments.studentUserId, studentIds),
          inArray(groupLessonEnrollments.status, ["confirmed", "completed"]),
        ),
      ),
    db
      .select({ classroomId: classroomParticipants.classroomId })
      .from(classroomParticipants)
      .where(inArray(classroomParticipants.userId, studentIds)),
  ]);
  const bookingIds = bookingRows.map((row) => row.id);
  const groupIds = enrollmentRows.map((row) => row.groupLessonId);
  const filters = [
    ...(bookingIds.length ? [inArray(classrooms.bookingId, bookingIds)] : []),
    ...(groupIds.length ? [inArray(classrooms.groupLessonId, groupIds)] : []),
    ...(participantRows.length
      ? [inArray(classrooms.id, participantRows.map((row) => row.classroomId))]
      : []),
  ];
  if (!filters.length) return [];
  const rows = await db
    .select({ id: classrooms.id })
    .from(classrooms)
    .where(filters.length === 1 ? filters[0] : or(...filters))
    .limit(80);
  return [...new Set(rows.map((row) => row.id))];
}

async function actorIsClassroomParticipant(userId: string, classroomId: string) {
  const [row] = await db
    .select({ userId: classroomParticipants.userId })
    .from(classroomParticipants)
    .where(
      and(
        eq(classroomParticipants.classroomId, classroomId),
        eq(classroomParticipants.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function requireVisibleClassroom(actor: ApiActor, classroomId: string) {
  const [row] = await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.id, classroomId))
    .limit(1);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Lesson classroom not found");
  if (isStaffAcademic(actor) || actor.userId === row.teacherUserId) return row;
  if (await actorCanViewClassroomRecordings(actor, row)) return row;
  if (await actorIsClassroomParticipant(actor.userId, row.id)) return row;
  throw new ApiError(403, "FORBIDDEN", "You cannot open this lesson for AI");
}

async function namesFor(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((row) => [row.id, row.name ?? "Learner"]));
}

function speakerRole(value: string | null | undefined): AiSpeakerRole {
  return value && isAiSpeakerRole(value) ? value : "unknown";
}

function actorSpeakerRole(actor: ApiActor): AiSpeakerRole {
  return speakerRoleFromActor(actor.roleKey, isStaffRole(actor.roleKey));
}

function actorSpeakerName(actor: ApiActor, locale: AiLocale = "en") {
  return actor.displayName?.trim() || genericSpeakerName(locale);
}

function speakersFrom(segments: AiTranscriptSegment[]) {
  return distinctTranscriptSpeakers(segments);
}

async function segmentsFromClassroom(
  classroomId: string,
): Promise<AiTranscriptSegment[]> {
  const [messages, participants] = await Promise.all([
    db
      .select({
        userId: classroomMessages.userId,
        body: classroomMessages.body,
        at: classroomMessages.createdAt,
      })
      .from(classroomMessages)
      .where(eq(classroomMessages.classroomId, classroomId))
      .orderBy(classroomMessages.createdAt)
      .limit(400),
    db
      .select({
        userId: classroomParticipants.userId,
        role: classroomParticipants.role,
      })
      .from(classroomParticipants)
      .where(eq(classroomParticipants.classroomId, classroomId)),
  ]);
  if (!messages.length) return [];
  const roleByUser = new Map(participants.map((row) => [row.userId, row.role]));
  const names = await namesFor([...new Set(messages.map((row) => row.userId))]);
  return messages.map((row) => ({
    speakerRole: speakerRole(roleByUser.get(row.userId)),
    speakerName: names.get(row.userId) ?? "Speaker",
    speakerUserId: row.userId,
    at: row.at.toISOString(),
    source: "chat",
    body: row.body,
  }));
}

function mergeIncomingSegments(
  current: AiTranscriptSegment[],
  incoming: AiTranscriptSegment[],
) {
  const next = [...current];
  for (const segment of incoming) {
    if (next.some((item) => sameTranscriptSegment(item, segment))) continue;
    next.push(segment);
  }
  return sortTranscriptSegments(next).slice(-400);
}

function fullTextFrom(segments: AiTranscriptSegment[]) {
  return segments
    .map((item) => `${item.speakerName}: ${item.body}`)
    .join("\n")
    .slice(0, 20000);
}

function payloadSource(payload: Record<string, unknown> | null | undefined): AiTranscriptSource {
  const value = payload?.source;
  return typeof value === "string" && isAiTranscriptSource(value) ? value : "chat";
}

function mergeSources(current: AiTranscriptSource, next: AiTranscriptSource): AiTranscriptSource {
  return current === next ? current : "mixed";
}

function segmentAt(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

async function latestRecordingId(classroomId: string) {
  const [row] = await db
    .select({ id: recordings.id })
    .from(recordings)
    .where(eq(recordings.classroomId, classroomId))
    .orderBy(desc(recordings.startedAt))
    .limit(1);
  return row?.id ?? null;
}

async function writeTranscriptJob(
  actor: ApiActor,
  input: {
    classroom: typeof classrooms.$inferSelect;
    recordingId?: string | null;
    locale?: AiLocale;
    segments: AiTranscriptSegment[];
    generatedByAi: boolean;
    ip: string;
    source: AiTranscriptSource;
  },
) {
  if (!canEditAi(actor) && input.source !== "speech") {
    throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can create AI work");
  }
  if (!canEditAi(actor) && !canCaptureSpeech(actor)) {
    throw new ApiError(403, "FORBIDDEN", "Only lesson participants can capture speech");
  }
  if (actor.roleKey === "teacher" && actor.userId !== input.classroom.teacherUserId) {
    throw new ApiError(403, "FORBIDDEN", "You can only transcribe your own lessons");
  }
  if (!input.segments.length) {
    throw new ApiError(
      400,
      "VALIDATION",
      "No speech or lesson chat is available to transcribe yet",
    );
  }
  const locale = detectAiLocale(fullTextFrom(input.segments), input.locale ?? "en");
  const prepared = prepareTranscriptSegments(input.segments, locale);
  const safe = safeTranscriptSegments(
    prepared,
    input.source === "typed" ? "reject" : "filter",
  );
  const segments = safe.segments;
  const text = fullTextFrom(segments);
  const speakers = speakersFrom(segments);
  const now = new Date();
  const identified = applyAiIdentification(
    {
      source: input.source,
      speakerCount: speakers.length,
      identifiedSpeakerCount: speakers.filter((item) => item.identified).length,
      language: locale,
      recognition: locale === "en" ? "en-GB" : "ar-SA",
      safety: aiSafetyPayload(safe.filtered),
    },
    input.generatedByAi,
  );
  const [job] = await db
    .insert(aiJobs)
    .values({
      kind: "transcription",
      status: "needs_review",
      sourceType: input.recordingId ? "recording" : "classroom",
      sourceId: input.recordingId ?? input.classroom.id,
      classroomId: input.classroom.id,
      recordingId: input.recordingId ?? null,
      locale,
      title: input.classroom.title,
      generatedByAi: identified.generatedByAi,
      requiresReview: aiKindRequiresReview("transcription"),
      payload: identified.payload,
      createdByUserId: actor.userId,
      updatedAt: now,
    })
    .returning();
  if (!job) throw new ApiError(500, "SERVER", "AI job could not be created");
  await db.insert(aiTranscripts).values({
    jobId: job.id,
    classroomId: input.classroom.id,
    recordingId: input.recordingId ?? null,
    locale,
    fullText: text,
    speakerCount: speakers.length,
    generatedByAi: identified.generatedByAi,
    segments,
    updatedAt: now,
  });
  await writeAuditLog({
    actor,
    action: "ai.transcription.created",
    entityType: "ai_job",
    entityId: job.id,
    ipAddress: input.ip,
    metadata: {
      classroomId: input.classroom.id,
      locale,
      generatedByAi: input.generatedByAi,
    },
  });
  return job.id;
}

async function findOpenTranscription(classroomId: string, locale: AiLocale) {
  const [existing] = await db
    .select()
    .from(aiJobs)
    .where(
      and(
        eq(aiJobs.classroomId, classroomId),
        eq(aiJobs.kind, "transcription"),
        eq(aiJobs.locale, locale),
        inArray(aiJobs.status, ["processing", "needs_review"]),
      ),
    )
    .orderBy(desc(aiJobs.createdAt))
    .limit(1);
  return existing ?? null;
}

async function appendToOpenTranscript(
  actor: ApiActor,
  input: {
    classroom: typeof classrooms.$inferSelect;
    recordingId?: string | null;
    locale: AiLocale;
    segments: AiTranscriptSegment[];
    generatedByAi: boolean;
    source: AiTranscriptSource;
    finalize?: boolean;
    ip: string;
    audit: string;
  },
) {
  const existing = await findOpenTranscription(input.classroom.id, input.locale);
  if (!existing) {
    return writeTranscriptJob(actor, {
      classroom: input.classroom,
      recordingId: input.recordingId,
      locale: input.locale,
      segments: input.segments,
      generatedByAi: input.generatedByAi,
      ip: input.ip,
      source: input.source,
    });
  }
  const [row] = await db
    .select()
    .from(aiTranscripts)
    .where(eq(aiTranscripts.jobId, existing.id))
    .limit(1);
  const incoming = safeTranscriptSegments(
    input.segments,
    input.source === "typed" ? "reject" : "filter",
  );
  const segments = mergeIncomingSegments(row?.segments ?? [], incoming.segments);
  const speakers = speakersFrom(segments);
  const now = new Date();
  const finalize = input.finalize !== false;
  const nextStatus: AiJobStatus =
    existing.status === "needs_review" || finalize ? "needs_review" : "processing";
  const identified = applyAiIdentification(
    {
      source: mergeSources(payloadSource(existing.payload), input.source),
      speakerCount: speakers.length,
      identifiedSpeakerCount: speakers.filter((item) => item.identified).length,
      language: input.locale,
      recognition: input.locale === "en" ? "en-GB" : "ar-SA",
      safety: aiSafetyPayload(incoming.filtered),
    },
    existing.generatedByAi || input.generatedByAi,
    existing,
  );
  await db
    .update(aiJobs)
    .set({
      status: nextStatus,
      sourceType: input.recordingId ? "recording" : existing.sourceType,
      sourceId: input.recordingId ?? existing.sourceId,
      recordingId: input.recordingId ?? existing.recordingId,
      locale: input.locale,
      generatedByAi: identified.generatedByAi,
      payload: identified.payload,
      updatedAt: now,
    })
    .where(eq(aiJobs.id, existing.id));
  if (row) {
    await db
      .update(aiTranscripts)
      .set({
        recordingId: input.recordingId ?? row.recordingId,
        locale: input.locale,
        fullText: fullTextFrom(segments),
        speakerCount: speakers.length,
        generatedByAi: identified.generatedByAi || row.generatedByAi,
        segments,
        updatedAt: now,
      })
      .where(eq(aiTranscripts.id, row.id));
  }
  await writeAuditLog({
    actor,
    action: input.audit,
    entityType: "ai_job",
    entityId: existing.id,
    ipAddress: input.ip,
    metadata: {
      classroomId: input.classroom.id,
      appended: input.segments.length,
      locale: input.locale,
    },
  });
  return existing.id;
}

async function saveSpeechTranscript(
  actor: ApiActor,
  input: {
    classroom: typeof classrooms.$inferSelect;
    recordingId?: string | null;
    locale?: AiLocale;
    finalize?: boolean;
    segments: {
      body: string;
      at?: string;
      startMs?: number;
      confidence?: number;
      speakerRole?: string;
      speakerName?: string;
      speakerUserId?: string;
    }[];
    ip: string;
  },
) {
  if (!canCaptureSpeech(actor)) {
    throw new ApiError(403, "FORBIDDEN", "Only lesson participants can capture speech");
  }
  if (actor.roleKey === "teacher" && actor.userId === input.classroom.teacherUserId) {
    // teacher of this lesson
  } else if (isStaffAcademic(actor)) {
    // academic staff
  } else if (actor.roleKey === "student") {
    // student in this lesson — visibility already checked
  } else if (actor.roleKey === "teacher") {
    throw new ApiError(403, "FORBIDDEN", "You can only transcribe your own lessons");
  }
  const requestedLocale = input.locale ?? "en";
  const speakerName = actorSpeakerName(actor, requestedLocale);
  const incoming: AiTranscriptSegment[] = input.segments
    .map((item) => ({
      speakerRole:
        item.speakerRole && isAiSpeakerRole(item.speakerRole)
          ? item.speakerRole
          : actorSpeakerRole(actor),
      speakerName: item.speakerName?.trim() || speakerName,
      speakerUserId: item.speakerUserId || actor.userId,
      at: segmentAt(item.at),
      startMs: item.startMs,
      confidence: item.confidence,
      source: "speech" as const,
      body: item.body.trim(),
    }))
    .filter((item) => item.body);
  const prepared = prepareTranscriptSegments(incoming, requestedLocale);
  if (!prepared.length) {
    throw new ApiError(400, "VALIDATION", "No speech was captured to transcribe");
  }
  const recordingId = input.recordingId ?? (await latestRecordingId(input.classroom.id));
  return appendToOpenTranscript(actor, {
    classroom: input.classroom,
    recordingId,
    locale: requestedLocale,
    segments: prepared,
    generatedByAi: true,
    source: "speech",
    finalize: input.finalize,
    ip: input.ip,
    audit: "ai.transcription.speech",
  });
}

function asStatus(value: string): AiJobStatus {
  return isAiJobStatus(value) ? value : "queued";
}

function asLocale(value: string): AiLocale {
  return isAiLocale(value) ? value : "en";
}

function payloadSentenceCount(payload: Record<string, unknown> | null | undefined) {
  const value = payload?.sentenceCount;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function summaryView(
  job: typeof aiJobs.$inferSelect,
  classroomTitle: string,
): AiSummaryView {
  const body = payloadSummaryBody(job.payload);
  return {
    id: job.id,
    classroomId: job.classroomId ?? "",
    classroomTitle,
    transcriptJobId: payloadSummaryTranscriptJobId(job.payload),
    locale: asLocale(job.locale),
    status: asStatus(job.status),
    origin: viewOrigin(job),
    generatedByAi: aiContentIsIdentified(viewOrigin(job)),
    body,
    sentenceCount: payloadSentenceCount(job.payload) || splitCount(body),
    keyPoints: payloadKeyPoints(job.payload),
    vocabulary: payloadVocabulary(job.payload),
    improvementAreas: payloadImprovementAreas(job.payload),
    nextLessonRecommendations: payloadNextLessonRecommendations(job.payload),
    createdAt: job.createdAt.toISOString(),
    reviewedAt: job.reviewedAt?.toISOString() ?? null,
    publishedAt: job.publishedAt?.toISOString() ?? null,
  };
}

function splitCount(body: string) {
  return body.split(/(?<=[.!?؟])\s+/).filter((part) => part.trim().length > 1).length;
}

async function loadSummaryJobs(
  classroomIds: string[],
  approvedOnly: boolean,
  pattern: string,
) {
  if (!classroomIds.length) return [] as (typeof aiJobs.$inferSelect)[];
  const filters = [
    inArray(aiJobs.classroomId, classroomIds),
    eq(aiJobs.kind, "summary"),
    approvedOnly ? eq(aiJobs.status, "approved") : undefined,
    pattern
      ? or(ilike(aiJobs.title, pattern), sql`${aiJobs.payload}::text ilike ${pattern}`)
      : undefined,
  ].filter(Boolean);
  return db
    .select()
    .from(aiJobs)
    .where(filters.length === 1 ? filters[0] : and(...filters))
    .orderBy(desc(aiJobs.createdAt))
    .limit(pattern ? 80 : 40);
}

async function writeSummaryJob(
  actor: ApiActor,
  input: {
    classroom: typeof classrooms.$inferSelect;
    locale: AiLocale;
    body: string;
    generatedByAi: boolean;
    transcriptJobId?: string | null;
    recordingId?: string | null;
    sentenceCount: number;
    keyPoints?: string[];
    vocabulary?: string[];
    improvementAreas?: string[];
    nextLessonRecommendations?: string[];
    ip: string;
  },
) {
  if (!canEditAi(actor)) {
    throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can write lesson summaries");
  }
  if (actor.roleKey === "teacher" && actor.userId !== input.classroom.teacherUserId) {
    throw new ApiError(403, "FORBIDDEN", "You can only summarise your own lessons");
  }
  const body = input.body.trim();
  if (body.length < 20) {
    throw new ApiError(400, "VALIDATION", "The lesson transcript is too short to summarise");
  }
  const safe = requireAiSafeFields(
    [
      body,
      ...(input.keyPoints ?? []),
      ...(input.vocabulary ?? []),
      ...(input.improvementAreas ?? []),
      ...(input.nextLessonRecommendations ?? []),
    ],
    input.generatedByAi ? "filter" : "reject",
  );
  const existing = await db
    .select()
    .from(aiJobs)
    .where(
      and(
        eq(aiJobs.classroomId, input.classroom.id),
        eq(aiJobs.kind, "summary"),
        eq(aiJobs.locale, input.locale),
        inArray(aiJobs.status, ["processing", "needs_review"]),
      ),
    )
    .orderBy(desc(aiJobs.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  const now = new Date();
  const safeBody = safe.texts[0] ?? body;
  let extra = 1;
  const takeSafeList = (source: string[] | undefined) => {
    if (!source) return undefined;
    const next = safe.texts.slice(extra, extra + source.length);
    extra += source.length;
    return next;
  };
  const payload = {
    body: safeBody.slice(0, 4000),
    transcriptJobId: input.transcriptJobId ?? null,
    engine: "extractive",
    sentenceCount: input.sentenceCount,
    keyPoints: (takeSafeList(input.keyPoints) ?? runAiModule.keyPoints({
      fullText: safeBody,
      locale: input.locale,
    })).slice(0, 8),
    vocabulary: (takeSafeList(input.vocabulary) ?? runAiModule.vocabulary({
      fullText: safeBody,
      locale: input.locale,
    })).slice(0, 16),
    improvementAreas: (takeSafeList(input.improvementAreas) ?? runAiModule.improvementAreas({
      fullText: safeBody,
      locale: input.locale,
    })).slice(0, 8),
    nextLessonRecommendations: (takeSafeList(input.nextLessonRecommendations) ?? runAiModule.nextLesson({
      fullText: safeBody,
      locale: input.locale,
    })).slice(0, 8),
    language: input.locale,
    safety: aiSafetyPayload(safe.filtered),
  };
  const identified = applyAiIdentification(payload, input.generatedByAi, existing);
  if (existing) {
    await db
      .update(aiJobs)
      .set({
        status: "needs_review",
        sourceType: input.recordingId ? "recording" : "classroom",
        sourceId: input.transcriptJobId ?? input.classroom.id,
        recordingId: input.recordingId ?? existing.recordingId,
        locale: input.locale,
        generatedByAi: identified.generatedByAi,
        requiresReview: aiKindRequiresReview("summary"),
        payload: identified.payload,
        ...unpublishedAcademicFields(),
        updatedAt: now,
      })
      .where(eq(aiJobs.id, existing.id));
    await writeAuditLog({
      actor,
      action: "ai.summary.updated",
      entityType: "ai_job",
      entityId: existing.id,
      ipAddress: input.ip,
      metadata: {
        classroomId: input.classroom.id,
        locale: input.locale,
        generatedByAi: input.generatedByAi,
      },
    });
    return existing.id;
  }
  const [job] = await db
    .insert(aiJobs)
    .values({
      kind: "summary",
      status: "needs_review",
      sourceType: input.recordingId ? "recording" : "classroom",
      sourceId: input.transcriptJobId ?? input.classroom.id,
      classroomId: input.classroom.id,
      recordingId: input.recordingId ?? null,
      locale: input.locale,
      title: input.classroom.title,
      generatedByAi: identified.generatedByAi,
      requiresReview: aiKindRequiresReview("summary"),
      payload: identified.payload,
      createdByUserId: actor.userId,
      updatedAt: now,
    })
    .returning();
  if (!job) throw new ApiError(500, "SERVER", "Lesson summary could not be created");
  await writeAuditLog({
    actor,
    action: "ai.summary.created",
    entityType: "ai_job",
    entityId: job.id,
    ipAddress: input.ip,
    metadata: {
      classroomId: input.classroom.id,
      locale: input.locale,
      generatedByAi: input.generatedByAi,
    },
  });
  return job.id;
}

function noteView(
  job: typeof aiJobs.$inferSelect,
  classroomTitle: string,
): AiNoteView {
  return {
    id: job.id,
    classroomId: job.classroomId ?? "",
    classroomTitle,
    transcriptJobId: payloadSummaryTranscriptJobId(job.payload),
    locale: asLocale(job.locale),
    status: asStatus(job.status),
    origin: viewOrigin(job),
    generatedByAi: aiContentIsIdentified(viewOrigin(job)),
    body: payloadNotesBody(job.payload),
    bullets: payloadNotesBullets(job.payload),
    createdAt: job.createdAt.toISOString(),
  };
}

async function loadNoteJobs(actorUserId: string, classroomIds: string[]) {
  if (!classroomIds.length) return [] as (typeof aiJobs.$inferSelect)[];
  return db
    .select()
    .from(aiJobs)
    .where(
      and(
        eq(aiJobs.kind, "notes"),
        eq(aiJobs.createdByUserId, actorUserId),
        inArray(aiJobs.classroomId, classroomIds),
      ),
    )
    .orderBy(desc(aiJobs.createdAt))
    .limit(40);
}

async function writeNoteJob(
  actor: ApiActor,
  input: {
    classroom: typeof classrooms.$inferSelect;
    locale: AiLocale;
    body: string;
    bullets: string[];
    generatedByAi: boolean;
    transcriptJobId?: string | null;
    recordingId?: string | null;
    ip: string;
  },
) {
  if (!canWriteNotes(actor)) {
    throw new ApiError(403, "FORBIDDEN", "Only learners, teachers, and staff can keep private notes");
  }
  const body = input.body.trim();
  if (body.length < 8) {
    throw new ApiError(400, "VALIDATION", "The lesson notes are too short");
  }
  const safe = requireAiSafeFields(
    [body, ...input.bullets],
    input.generatedByAi ? "filter" : "reject",
  );
  const existing = await db
    .select()
    .from(aiJobs)
    .where(
      and(
        eq(aiJobs.classroomId, input.classroom.id),
        eq(aiJobs.kind, "notes"),
        eq(aiJobs.locale, input.locale),
        eq(aiJobs.createdByUserId, actor.userId),
      ),
    )
    .orderBy(desc(aiJobs.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  const now = new Date();
  const safeBody = safe.texts[0] ?? body;
  const safeBullets = safe.texts.slice(1, 1 + input.bullets.length);
  const payload = {
    body: safeBody.slice(0, 4000),
    bullets: (safeBullets.length ? safeBullets : input.bullets).slice(0, 10),
    transcriptJobId: input.transcriptJobId ?? null,
    engine: "extractive",
    language: input.locale,
    private: true,
    safety: aiSafetyPayload(safe.filtered),
  };
  const identified = applyAiIdentification(payload, input.generatedByAi, existing);
  if (existing) {
    await db
      .update(aiJobs)
      .set({
        status: "ready",
        sourceType: input.recordingId ? "recording" : "classroom",
        sourceId: input.transcriptJobId ?? input.classroom.id,
        recordingId: input.recordingId ?? existing.recordingId,
        locale: input.locale,
        generatedByAi: identified.generatedByAi,
        requiresReview: false,
        payload: identified.payload,
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(aiJobs.id, existing.id));
    await writeAuditLog({
      actor,
      action: "ai.notes.updated",
      entityType: "ai_job",
      entityId: existing.id,
      ipAddress: input.ip,
      metadata: { classroomId: input.classroom.id, locale: input.locale },
    });
    return existing.id;
  }
  const [job] = await db
    .insert(aiJobs)
    .values({
      kind: "notes",
      status: "ready",
      sourceType: input.recordingId ? "recording" : "classroom",
      sourceId: input.transcriptJobId ?? input.classroom.id,
      classroomId: input.classroom.id,
      recordingId: input.recordingId ?? null,
      locale: input.locale,
      title: input.classroom.title,
      generatedByAi: identified.generatedByAi,
      requiresReview: false,
      payload: identified.payload,
      createdByUserId: actor.userId,
      publishedAt: now,
      updatedAt: now,
    })
    .returning();
  if (!job) throw new ApiError(500, "SERVER", "Lesson notes could not be created");
  await writeAuditLog({
    actor,
    action: "ai.notes.created",
    entityType: "ai_job",
    entityId: job.id,
    ipAddress: input.ip,
    metadata: { classroomId: input.classroom.id, locale: input.locale },
  });
  return job.id;
}

function homeworkView(
  job: typeof aiJobs.$inferSelect,
  classroomTitle: string,
): AiHomeworkView {
  const title = payloadHomeworkTitle(job.payload) || job.title || classroomTitle;
  return {
    id: job.id,
    classroomId: job.classroomId ?? "",
    classroomTitle,
    transcriptJobId: payloadSummaryTranscriptJobId(job.payload),
    locale: asLocale(job.locale),
    status: asStatus(job.status),
    origin: viewOrigin(job),
    generatedByAi: aiContentIsIdentified(viewOrigin(job)),
    title,
    body: payloadHomeworkBody(job.payload),
    tasks: payloadHomeworkTasks(job.payload),
    createdAt: job.createdAt.toISOString(),
    reviewedAt: job.reviewedAt?.toISOString() ?? null,
    publishedAt: job.publishedAt?.toISOString() ?? null,
  };
}

async function loadHomeworkJobs(
  classroomIds: string[],
  approvedOnly: boolean,
  pattern: string,
) {
  if (!classroomIds.length) return [] as (typeof aiJobs.$inferSelect)[];
  const filters = [
    inArray(aiJobs.classroomId, classroomIds),
    eq(aiJobs.kind, "homework"),
    approvedOnly ? eq(aiJobs.status, "approved") : undefined,
    pattern
      ? or(ilike(aiJobs.title, pattern), sql`${aiJobs.payload}::text ilike ${pattern}`)
      : undefined,
  ].filter(Boolean);
  return db
    .select()
    .from(aiJobs)
    .where(filters.length === 1 ? filters[0] : and(...filters))
    .orderBy(desc(aiJobs.createdAt))
    .limit(pattern ? 80 : 40);
}

async function writeHomeworkJob(
  actor: ApiActor,
  input: {
    classroom: typeof classrooms.$inferSelect;
    locale: AiLocale;
    title: string;
    body: string;
    tasks: string[];
    generatedByAi: boolean;
    transcriptJobId?: string | null;
    recordingId?: string | null;
    ip: string;
  },
) {
  if (!canEditAi(actor)) {
    throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate homework");
  }
  if (actor.roleKey === "teacher" && actor.userId !== input.classroom.teacherUserId) {
    throw new ApiError(403, "FORBIDDEN", "You can only generate homework for your own lessons");
  }
  const title = input.title.trim().slice(0, 160);
  const body = input.body.trim();
  if (title.length < 2) {
    throw new ApiError(400, "VALIDATION", "The homework title is too short");
  }
  if (body.length < 20) {
    throw new ApiError(400, "VALIDATION", "The homework draft is too short");
  }
  const safe = requireAiSafeFields(
    [title, body, ...input.tasks],
    input.generatedByAi ? "filter" : "reject",
  );
  const existing = await db
    .select()
    .from(aiJobs)
    .where(
      and(
        eq(aiJobs.classroomId, input.classroom.id),
        eq(aiJobs.kind, "homework"),
        eq(aiJobs.locale, input.locale),
        inArray(aiJobs.status, ["processing", "needs_review"]),
      ),
    )
    .orderBy(desc(aiJobs.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  const now = new Date();
  const safeTitle = safe.texts[0] ?? title;
  const safeBody = safe.texts[1] ?? body;
  const safeTasks = safe.texts.slice(2, 2 + input.tasks.length);
  const payload = {
    title: safeTitle,
    body: safeBody.slice(0, 4000),
    tasks: (safeTasks.length ? safeTasks : input.tasks).slice(0, 8),
    transcriptJobId: input.transcriptJobId ?? null,
    engine: "extractive",
    language: input.locale,
    safety: aiSafetyPayload(safe.filtered),
  };
  const identified = applyAiIdentification(payload, input.generatedByAi, existing);
  if (existing) {
    await db
      .update(aiJobs)
      .set({
        status: "needs_review",
        sourceType: input.recordingId ? "recording" : "classroom",
        sourceId: input.transcriptJobId ?? input.classroom.id,
        recordingId: input.recordingId ?? existing.recordingId,
        locale: input.locale,
        title: safeTitle,
        generatedByAi: identified.generatedByAi,
        requiresReview: aiKindRequiresReview("homework"),
        payload: identified.payload,
        ...unpublishedAcademicFields(),
        updatedAt: now,
      })
      .where(eq(aiJobs.id, existing.id));
    await writeAuditLog({
      actor,
      action: "ai.homework.updated",
      entityType: "ai_job",
      entityId: existing.id,
      ipAddress: input.ip,
      metadata: {
        classroomId: input.classroom.id,
        locale: input.locale,
        generatedByAi: input.generatedByAi,
      },
    });
    return existing.id;
  }
  const [job] = await db
    .insert(aiJobs)
    .values({
      kind: "homework",
      status: "needs_review",
      sourceType: input.recordingId ? "recording" : "classroom",
      sourceId: input.transcriptJobId ?? input.classroom.id,
      classroomId: input.classroom.id,
      recordingId: input.recordingId ?? null,
      locale: input.locale,
      title: safeTitle,
      generatedByAi: identified.generatedByAi,
      requiresReview: aiKindRequiresReview("homework"),
      payload: identified.payload,
      createdByUserId: actor.userId,
      updatedAt: now,
    })
    .returning();
  if (!job) throw new ApiError(500, "SERVER", "Homework draft could not be created");
  await writeAuditLog({
    actor,
    action: "ai.homework.created",
    entityType: "ai_job",
    entityId: job.id,
    ipAddress: input.ip,
    metadata: {
      classroomId: input.classroom.id,
      locale: input.locale,
      generatedByAi: input.generatedByAi,
    },
  });
  return job.id;
}

function quizQuestionsFromBank(
  items: Array<{ id: string; kind: string; prompt: string; body: unknown }>,
): AiQuizQuestionDraft[] {
  const questions: AiQuizQuestionDraft[] = [];
  for (const item of items) {
    const parsed = bankItemToQuizQuestion({
      id: item.id,
      kind: item.kind as "choice" | "true_false" | "short" | "written",
      prompt: item.prompt,
      body: item.body,
    });
    if (parsed.kind === "choice") {
      questions.push({
        kind: "choice",
        prompt: parsed.prompt,
        choices: parsed.choices,
        choiceAnswer: parsed.answer,
        bankId: item.id,
      });
    } else if (parsed.kind === "true_false") {
      questions.push({
        kind: "true_false",
        prompt: parsed.prompt,
        answer: parsed.answer,
        bankId: item.id,
      });
    } else if (parsed.kind === "short") {
      questions.push({
        kind: "short",
        prompt: parsed.prompt,
        accepted: parsed.accepted,
        bankId: item.id,
      });
    } else {
      questions.push({ kind: "written", prompt: parsed.prompt, bankId: item.id });
    }
    if (questions.length >= 8) break;
  }
  return questions;
}

function bookSourceText(
  title: string,
  description: string | null,
  pages: Array<{ title?: string; body?: string[] }> | null | undefined,
) {
  const lines = [title, description ?? ""];
  for (const page of pages ?? []) {
    if (page.title) lines.push(page.title);
    lines.push(...(page.body ?? []));
  }
  return lines.map((line) => line.trim()).filter(Boolean).join(" ");
}

function canSeeAiBook(
  actor: ApiActor,
  item: { status: string; audience: string; createdByUserId: string | null },
) {
  if (isStaffAcademic(actor) || item.createdByUserId === actor.userId) return true;
  if (item.status !== "published") return false;
  if (item.audience === "staff") return isStaffRole(actor.roleKey);
  if (item.audience === "teachers") {
    return actor.roleKey === "teacher" || isStaffRole(actor.roleKey);
  }
  return actor.roleKey === "teacher" || isStaffRole(actor.roleKey);
}

async function loadAiBooks(actor: ApiActor): Promise<AiBookOption[]> {
  if (!canEditAi(actor)) return [];
  const rows = await db
    .select({
      id: teachingMaterials.id,
      title: teachingMaterials.title,
      category: teachingMaterials.category,
      status: teachingMaterials.status,
      audience: teachingMaterials.audience,
      createdByUserId: teachingMaterials.createdByUserId,
    })
    .from(teachingMaterials)
    .where(inArray(teachingMaterials.category, [...LIBRARY_BOOK_CATEGORIES]))
    .orderBy(desc(teachingMaterials.updatedAt))
    .limit(80);
  return rows
    .filter((row) => canSeeAiBook(actor, row))
    .map((row) => ({ id: row.id, title: row.title, category: row.category }));
}

async function loadAiTopics(actor: ApiActor): Promise<AiTopicOption[]> {
  if (!canEditAi(actor)) return [];
  const rows = await db
    .select({
      topic: questionBankItems.topic,
      status: questionBankItems.status,
      createdByUserId: questionBankItems.createdByUserId,
    })
    .from(questionBankItems)
    .orderBy(desc(questionBankItems.updatedAt))
    .limit(200);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const topic = row.topic?.trim();
    if (!topic) continue;
    const own = row.createdByUserId === actor.userId || isStaffAcademic(actor);
    if (!own && row.status !== "published") continue;
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((left, right) => right.count - left.count || left.topic.localeCompare(right.topic))
    .slice(0, 40);
}

async function loadAiUploads(
  actor: ApiActor,
  classroomIds: string[],
): Promise<AiUploadOption[]> {
  if (!canEditAi(actor)) return [];
  const owned = await db
    .select({
      id: files.id,
      name: files.originalName,
    })
    .from(files)
    .where(and(eq(files.ownerUserId, actor.userId), like(files.storageKey, "ai:upload:%")))
    .orderBy(desc(files.createdAt))
    .limit(40);
  const roomFiles = classroomIds.length
    ? await db
        .select({
          id: files.id,
          name: files.originalName,
          mimeType: files.mimeType,
          classroomId: classroomFiles.classroomId,
          classroomTitle: classrooms.title,
        })
        .from(classroomFiles)
        .innerJoin(files, eq(files.id, classroomFiles.fileId))
        .innerJoin(classrooms, eq(classrooms.id, classroomFiles.classroomId))
        .where(inArray(classroomFiles.classroomId, classroomIds))
        .orderBy(desc(classroomFiles.createdAt))
        .limit(80)
    : [];
  const seen = new Set<string>();
  const uploads: AiUploadOption[] = [];
  for (const row of roomFiles) {
    const name = row.name?.trim() || "document";
    if (!resolveAiUploadType(row.mimeType, name)) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    uploads.push({
      id: row.id,
      name,
      classroomId: row.classroomId,
      classroomTitle: row.classroomTitle,
    });
  }
  for (const row of owned) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    uploads.push({
      id: row.id,
      name: row.name?.trim() || "document",
    });
  }
  return uploads.slice(0, 40);
}

async function loadUsableAiUpload(actor: ApiActor, fileId: string) {
  const [row] = await db
    .select({
      id: files.id,
      name: files.originalName,
      mimeType: files.mimeType,
      storageKey: files.storageKey,
      ownerUserId: files.ownerUserId,
      content: fileObjects.content,
    })
    .from(files)
    .innerJoin(fileObjects, eq(fileObjects.fileId, files.id))
    .where(eq(files.id, fileId))
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Uploaded document not found");
  }
  const name = row.name?.trim() || "document";
  const mime = resolveAiUploadType(row.mimeType, name);
  if (!mime) {
    throw new ApiError(422, "VALIDATION", "That document type cannot be used for a quiz");
  }
  const ownedUpload =
    row.ownerUserId === actor.userId && row.storageKey.startsWith("ai:upload:");
  if (ownedUpload) {
    return { id: row.id, name, mimeType: mime, content: row.content };
  }
  const [shared] = await db
    .select({
      classroomId: classroomFiles.classroomId,
      teacherUserId: classrooms.teacherUserId,
    })
    .from(classroomFiles)
    .innerJoin(classrooms, eq(classrooms.id, classroomFiles.classroomId))
    .where(eq(classroomFiles.fileId, fileId))
    .limit(1);
  if (
    shared &&
    (isStaffAcademic(actor) || actor.userId === shared.teacherUserId)
  ) {
    return { id: row.id, name, mimeType: mime, content: row.content };
  }
  throw new ApiError(403, "FORBIDDEN", "You cannot open this document for a quiz");
}

async function loadAiPreviousLessons(
  actor: ApiActor,
  classroomIds: string[],
): Promise<AiPreviousLessonOption[]> {
  if (!canEditAi(actor) || classroomIds.length < 2) return [];
  const transcriptRows = await db
    .select({
      classroomId: aiTranscripts.classroomId,
      locale: aiJobs.locale,
      fullText: aiTranscripts.fullText,
      updatedAt: aiJobs.updatedAt,
    })
    .from(aiTranscripts)
    .innerJoin(aiJobs, eq(aiTranscripts.jobId, aiJobs.id))
    .where(
      and(
        inArray(aiTranscripts.classroomId, classroomIds),
        eq(aiJobs.kind, "transcription"),
      ),
    )
    .orderBy(desc(aiJobs.updatedAt))
    .limit(80);
  const summaryRows = await db
    .select({
      classroomId: aiJobs.classroomId,
      locale: aiJobs.locale,
      payload: aiJobs.payload,
      updatedAt: aiJobs.updatedAt,
    })
    .from(aiJobs)
    .where(
      and(inArray(aiJobs.classroomId, classroomIds), eq(aiJobs.kind, "summary")),
    )
    .orderBy(desc(aiJobs.updatedAt))
    .limit(80);
  const rooms = await db
    .select({ id: classrooms.id, title: classrooms.title })
    .from(classrooms)
    .where(inArray(classrooms.id, classroomIds));
  const titleByRoom = new Map(rooms.map((row) => [row.id, row.title]));
  const byRoom = new Map<string, AiPreviousLessonOption>();
  for (const row of transcriptRows) {
    if (!row.classroomId || row.fullText.trim().length < 20) continue;
    if (byRoom.has(row.classroomId)) continue;
    byRoom.set(row.classroomId, {
      id: row.classroomId,
      title: titleByRoom.get(row.classroomId) || "Lesson",
      locale: asLocale(row.locale),
    });
  }
  for (const row of summaryRows) {
    if (!row.classroomId || byRoom.has(row.classroomId)) continue;
    const body = [
      payloadSummaryBody(row.payload),
      ...payloadKeyPoints(row.payload),
      ...payloadVocabulary(row.payload),
    ]
      .join(" ")
      .trim();
    if (body.length < 20) continue;
    byRoom.set(row.classroomId, {
      id: row.classroomId,
      title: titleByRoom.get(row.classroomId) || "Lesson",
      locale: asLocale(row.locale),
    });
  }
  return [...byRoom.values()].sort((left, right) =>
    left.title.localeCompare(right.title),
  );
}

async function previousLessonSource(classroomId: string, locale: AiLocale) {
  const transcripts = await db
    .select({
      jobId: aiJobs.id,
      locale: aiJobs.locale,
      fullText: aiTranscripts.fullText,
      updatedAt: aiJobs.updatedAt,
    })
    .from(aiTranscripts)
    .innerJoin(aiJobs, eq(aiTranscripts.jobId, aiJobs.id))
    .where(
      and(
        eq(aiTranscripts.classroomId, classroomId),
        eq(aiJobs.kind, "transcription"),
      ),
    )
    .orderBy(desc(aiJobs.updatedAt))
    .limit(8);
  const summaries = await db
    .select({
      locale: aiJobs.locale,
      payload: aiJobs.payload,
      updatedAt: aiJobs.updatedAt,
    })
    .from(aiJobs)
    .where(and(eq(aiJobs.classroomId, classroomId), eq(aiJobs.kind, "summary")))
    .orderBy(desc(aiJobs.updatedAt))
    .limit(8);
  const matchingTranscript =
    transcripts.find((row) => asLocale(row.locale) === locale && row.fullText.trim()) ??
    transcripts.find((row) => row.fullText.trim());
  const matchingSummary =
    summaries.find((row) => asLocale(row.locale) === locale) ?? summaries[0];
  const summaryText = matchingSummary
    ? [
        payloadSummaryBody(matchingSummary.payload),
        ...payloadKeyPoints(matchingSummary.payload),
        ...payloadVocabulary(matchingSummary.payload),
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const fullText = [matchingTranscript?.fullText ?? "", summaryText]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    fullText,
    transcriptJobId: matchingTranscript?.jobId ?? null,
  };
}

export async function generateQuizFromUploadedDocument(
  actor: ApiActor,
  input: {
    classroomId: string;
    locale?: AiLocale;
    fileId?: string;
    name?: string;
    mimeType?: string;
    bytes?: Buffer;
  },
  ip: string,
) {
  assertAiModuleLive("quiz");
  if (!canEditAi(actor)) {
    throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate quizzes");
  }
  const classroom = await requireVisibleClassroom(actor, input.classroomId);
  if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
    throw new ApiError(403, "FORBIDDEN", "You can only generate quizzes for your own lessons");
  }

  let fileId = input.fileId;
  let name = "";
  let mime = "";
  const bytes = input.bytes;

  let fullText = "";
  if (bytes && input.name) {
    name = sanitizeAiUploadName(input.name);
    mime = resolveAiUploadType(input.mimeType ?? "", name) ?? "";
    if (!mime) {
      throw new ApiError(422, "VALIDATION", "That document type cannot be used for a quiz");
    }
    if (bytes.byteLength > AI_UPLOAD_MAX_BYTES) {
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "That document is larger than 8 MB");
    }
    if (classroomContainsContactDetails(name)) {
      throw new ApiError(
        422,
        "CONTACT_BLOCKED",
        "Keep phone numbers and personal accounts off file names",
      );
    }
    try {
      fullText = extractUploadedDocumentText(bytes, mime, name);
    } catch (error) {
      throw new ApiError(
        422,
        "VALIDATION",
        error instanceof Error ? error.message : "That document is not readable",
      );
    }
    fileId = randomUUID();
    await db.insert(files).values({
      id: fileId,
      ownerUserId: actor.userId,
      purpose: "other",
      storageKey: `ai:upload:${fileId}:${name}`,
      mimeType: mime,
      byteSize: bytes.byteLength,
      originalName: name,
      visibility: "restricted",
    });
    await db.insert(fileObjects).values({
      fileId,
      content: bytes,
    });
    await writeAuditLog({
      actor,
      action: "ai.upload.created",
      entityType: "file",
      entityId: fileId,
      ipAddress: ip,
      metadata: { classroomId: classroom.id, mimeType: mime },
    });
  } else if (fileId) {
    const loaded = await loadUsableAiUpload(actor, fileId);
    fileId = loaded.id;
    name = loaded.name;
    mime = loaded.mimeType;
    try {
      fullText = extractUploadedDocumentText(loaded.content, mime, name);
    } catch (error) {
      throw new ApiError(
        422,
        "VALIDATION",
        error instanceof Error ? error.message : "That document is not readable",
      );
    }
  } else {
    throw new ApiError(400, "VALIDATION", "Choose a document to write a quiz from");
  }
  if (!fileId) {
    throw new ApiError(400, "VALIDATION", "Choose a document to write a quiz from");
  }
  const locale = input.locale ?? "en";
  const title = name.replace(/\.[^.]+$/, "").trim().slice(0, 160) || classroom.title;
  const draft = runAiModule.quiz({
    fullText,
    locale,
    title,
  });
  if (!draft.questions.length) {
    throw new ApiError(400, "VALIDATION", "That document has no extractable quiz questions");
  }
  await writeQuizJob(actor, {
    classroom,
    locale,
    title: draft.title,
    body: draft.body,
    questions: draft.questions,
    generatedByAi: true,
    source: "upload",
    sourceType: "upload",
    sourceId: fileId,
    fileName: name,
    ip,
  });
  return getAiSystemsDesk(actor);
}

function quizView(
  job: typeof aiJobs.$inferSelect,
  classroomTitle: string,
  hideAnswers: boolean,
): AiQuizView {
  const questions = hideAnswers
    ? hideQuizAnswers(payloadQuizQuestions(job.payload))
    : payloadQuizQuestions(job.payload);
  const source = payloadQuizSource(job.payload);
  const topic = payloadQuizTopic(job.payload);
  const fileName = payloadQuizFileName(job.payload);
  return {
    id: job.id,
    classroomId: job.classroomId ?? "",
    classroomTitle,
    source,
    sourceLabel:
      source === "topic"
        ? topic || classroomTitle
        : source === "upload"
          ? fileName || payloadQuizTitle(job.payload) || classroomTitle
          : source === "previous"
            ? payloadQuizPreviousTitle(job.payload) ||
              payloadQuizTitle(job.payload) ||
              classroomTitle
            : payloadQuizTitle(job.payload) || job.title || classroomTitle,
    transcriptJobId: payloadSummaryTranscriptJobId(job.payload),
    locale: asLocale(job.locale),
    status: asStatus(job.status),
    origin: viewOrigin(job),
    generatedByAi: aiContentIsIdentified(viewOrigin(job)),
    title: payloadQuizTitle(job.payload) || job.title || classroomTitle,
    body: payloadQuizBody(job.payload),
    questions,
    createdAt: job.createdAt.toISOString(),
    reviewedAt: job.reviewedAt?.toISOString() ?? null,
    publishedAt: job.publishedAt?.toISOString() ?? null,
  };
}

async function loadQuizJobs(
  classroomIds: string[],
  approvedOnly: boolean,
  pattern: string,
) {
  if (!classroomIds.length) return [] as (typeof aiJobs.$inferSelect)[];
  const filters = [
    inArray(aiJobs.classroomId, classroomIds),
    eq(aiJobs.kind, "quiz"),
    approvedOnly ? eq(aiJobs.status, "approved") : undefined,
    pattern
      ? or(ilike(aiJobs.title, pattern), sql`${aiJobs.payload}::text ilike ${pattern}`)
      : undefined,
  ].filter(Boolean);
  return db
    .select()
    .from(aiJobs)
    .where(filters.length === 1 ? filters[0] : and(...filters))
    .orderBy(desc(aiJobs.createdAt))
    .limit(pattern ? 80 : 40);
}

async function writeQuizJob(
  actor: ApiActor,
  input: {
    classroom: typeof classrooms.$inferSelect;
    locale: AiLocale;
    title: string;
    body: string;
    questions: AiQuizQuestionDraft[];
    generatedByAi: boolean;
    source: AiQuizSource;
    sourceType: "classroom" | "material" | "topic" | "upload";
    sourceId?: string | null;
    transcriptJobId?: string | null;
    materialId?: string | null;
    topic?: string | null;
    fileName?: string | null;
    previousClassroomId?: string | null;
    previousTitle?: string | null;
    recordingId?: string | null;
    ip: string;
  },
) {
  if (!canEditAi(actor)) {
    throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate quizzes");
  }
  if (actor.roleKey === "teacher" && actor.userId !== input.classroom.teacherUserId) {
    throw new ApiError(403, "FORBIDDEN", "You can only generate quizzes for your own lessons");
  }
  const title = input.title.trim().slice(0, 160);
  const body = input.body.trim();
  if (title.length < 2) {
    throw new ApiError(400, "VALIDATION", "The quiz title is too short");
  }
  if (body.length < 20 && input.questions.length < 1) {
    throw new ApiError(400, "VALIDATION", "The quiz draft is too short");
  }
  if (!input.questions.length) {
    throw new ApiError(400, "VALIDATION", "The quiz draft has no questions");
  }
  const safe = requireAiSafeFields(
    [title, body, ...input.questions.flatMap(quizQuestionSafetyFields)],
    input.generatedByAi ? "filter" : "reject",
  );
  const openFilters = [
    eq(aiJobs.classroomId, input.classroom.id),
    eq(aiJobs.kind, "quiz"),
    eq(aiJobs.locale, input.locale),
    eq(aiJobs.sourceType, input.sourceType),
    inArray(aiJobs.status, ["processing", "needs_review"]),
    input.sourceType === "topic" && input.topic
      ? sql`${aiJobs.payload}->>'topic' = ${input.topic}`
      : input.sourceId
        ? eq(aiJobs.sourceId, input.sourceId)
        : undefined,
  ].filter(Boolean);
  const existing = await db
    .select()
    .from(aiJobs)
    .where(and(...openFilters))
    .orderBy(desc(aiJobs.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  const now = new Date();
  const safeTitle = safe.texts[0] ?? title;
  const safeBody = safe.texts[1] ?? body;
  let extra = 2;
  const questions = input.questions.map((item) => {
    const prompt = safe.texts[extra] ?? item.prompt;
    extra += 1;
    const accepted = (item.accepted ?? []).map((value) => {
      const next = safe.texts[extra] ?? value;
      extra += 1;
      return next;
    });
    const choices = (item.choices ?? []).map((value) => {
      const next = safe.texts[extra] ?? value;
      extra += 1;
      return next;
    });
    return {
      ...item,
      prompt,
      accepted: item.accepted ? accepted : undefined,
      choices: item.choices ? choices : undefined,
    };
  });
  const payload = {
    title: safeTitle,
    body: (safeBody || questions.map((item) => item.prompt).join(" ")).slice(0, 4000),
    questions: questions.slice(0, 8),
    source: input.source,
    transcriptJobId: input.transcriptJobId ?? null,
    materialId: input.materialId ?? null,
    topic: input.topic ?? null,
    fileName: input.fileName ?? null,
    previousClassroomId: input.previousClassroomId ?? null,
    previousTitle: input.previousTitle ?? null,
    engine: "extractive",
    language: input.locale,
    safety: aiSafetyPayload(safe.filtered),
  };
  const identified = applyAiIdentification(payload, input.generatedByAi, existing);
  if (existing) {
    await db
      .update(aiJobs)
      .set({
        status: "needs_review",
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? input.classroom.id,
        recordingId: input.recordingId ?? existing.recordingId,
        locale: input.locale,
        title: safeTitle,
        generatedByAi: identified.generatedByAi,
        requiresReview: aiKindRequiresReview("quiz"),
        payload: identified.payload,
        ...unpublishedAcademicFields(),
        updatedAt: now,
      })
      .where(eq(aiJobs.id, existing.id));
    await writeAuditLog({
      actor,
      action: "ai.quiz.updated",
      entityType: "ai_job",
      entityId: existing.id,
      ipAddress: input.ip,
      metadata: {
        classroomId: input.classroom.id,
        locale: input.locale,
        source: input.source,
        generatedByAi: input.generatedByAi,
      },
    });
    return existing.id;
  }
  const [job] = await db
    .insert(aiJobs)
    .values({
      kind: "quiz",
      status: "needs_review",
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? input.classroom.id,
      classroomId: input.classroom.id,
      recordingId: input.recordingId ?? null,
      locale: input.locale,
      title: safeTitle,
      generatedByAi: identified.generatedByAi,
      requiresReview: aiKindRequiresReview("quiz"),
      payload: identified.payload,
      createdByUserId: actor.userId,
      updatedAt: now,
    })
    .returning();
  if (!job) throw new ApiError(500, "SERVER", "Quiz draft could not be created");
  await writeAuditLog({
    actor,
    action: "ai.quiz.created",
    entityType: "ai_job",
    entityId: job.id,
    ipAddress: input.ip,
    metadata: {
      classroomId: input.classroom.id,
      locale: input.locale,
      source: input.source,
      generatedByAi: input.generatedByAi,
    },
  });
  return job.id;
}

function recommendationView(
  job: typeof aiJobs.$inferSelect,
  classroomTitle: string,
): AiRecommendationView {
  const previousTitle = payloadRecommendationPreviousTitle(job.payload);
  return {
    id: job.id,
    classroomId: job.classroomId ?? "",
    classroomTitle,
    sourceLabel: previousTitle || payloadRecommendationTitle(job.payload) || classroomTitle,
    transcriptJobId: payloadSummaryTranscriptJobId(job.payload),
    locale: asLocale(job.locale),
    status: asStatus(job.status),
    origin: viewOrigin(job),
    generatedByAi: aiContentIsIdentified(viewOrigin(job)),
    title: payloadRecommendationTitle(job.payload) || job.title || classroomTitle,
    body: payloadRecommendationBody(job.payload),
    items: payloadRecommendationItems(job.payload),
    focus: payloadRecommendationFocus(job.payload),
    createdAt: job.createdAt.toISOString(),
    reviewedAt: job.reviewedAt?.toISOString() ?? null,
    publishedAt: job.publishedAt?.toISOString() ?? null,
  };
}

async function loadRecommendationJobs(
  classroomIds: string[],
  approvedOnly: boolean,
  pattern: string,
) {
  if (!classroomIds.length) return [] as (typeof aiJobs.$inferSelect)[];
  const filters = [
    inArray(aiJobs.classroomId, classroomIds),
    eq(aiJobs.kind, "recommendation"),
    approvedOnly ? eq(aiJobs.status, "approved") : undefined,
    pattern
      ? or(ilike(aiJobs.title, pattern), sql`${aiJobs.payload}::text ilike ${pattern}`)
      : undefined,
  ].filter(Boolean);
  return db
    .select()
    .from(aiJobs)
    .where(filters.length === 1 ? filters[0] : and(...filters))
    .orderBy(desc(aiJobs.createdAt))
    .limit(pattern ? 80 : 40);
}

async function writeRecommendationJob(
  actor: ApiActor,
  input: {
    classroom: typeof classrooms.$inferSelect;
    locale: AiLocale;
    title: string;
    body: string;
    items: string[];
    focus: string[];
    generatedByAi: boolean;
    sourceId?: string | null;
    transcriptJobId?: string | null;
    previousClassroomId?: string | null;
    previousTitle?: string | null;
    recordingId?: string | null;
    ip: string;
  },
) {
  if (!canEditAi(actor)) {
    throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate recommendations");
  }
  if (actor.roleKey === "teacher" && actor.userId !== input.classroom.teacherUserId) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "You can only generate recommendations for your own lessons",
    );
  }
  const title = input.title.trim().slice(0, 160);
  const body = input.body.trim();
  if (title.length < 2) {
    throw new ApiError(400, "VALIDATION", "The recommendation title is too short");
  }
  if (body.length < 20 && input.items.length < 1) {
    throw new ApiError(400, "VALIDATION", "The recommendation draft is too short");
  }
  if (!input.items.length) {
    throw new ApiError(400, "VALIDATION", "The recommendation draft has no suggested work");
  }
  const safe = requireAiSafeFields(
    [title, body, ...input.items, ...input.focus],
    input.generatedByAi ? "filter" : "reject",
  );
  const openFilters = [
    eq(aiJobs.classroomId, input.classroom.id),
    eq(aiJobs.kind, "recommendation"),
    eq(aiJobs.locale, input.locale),
    inArray(aiJobs.status, ["processing", "needs_review"]),
    input.sourceId ? eq(aiJobs.sourceId, input.sourceId) : undefined,
  ].filter(Boolean);
  const existing = await db
    .select()
    .from(aiJobs)
    .where(and(...openFilters))
    .orderBy(desc(aiJobs.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  const now = new Date();
  const safeTitle = safe.texts[0] ?? title;
  const safeBody = safe.texts[1] ?? body;
  const safeItems = safe.texts.slice(2, 2 + input.items.length);
  const safeFocus = safe.texts.slice(2 + input.items.length, 2 + input.items.length + input.focus.length);
  const payload = {
    title: safeTitle,
    body: (safeBody || safeItems.join(" ")).slice(0, 4000),
    items: (safeItems.length ? safeItems : input.items).slice(0, 8),
    focus: (safeFocus.length ? safeFocus : input.focus).slice(0, 6),
    transcriptJobId: input.transcriptJobId ?? null,
    previousClassroomId: input.previousClassroomId ?? null,
    previousTitle: input.previousTitle ?? null,
    engine: "extractive",
    language: input.locale,
    safety: aiSafetyPayload(safe.filtered),
  };
  const identified = applyAiIdentification(payload, input.generatedByAi, existing);
  if (existing) {
    await db
      .update(aiJobs)
      .set({
        status: "needs_review",
        sourceType: "classroom",
        sourceId: input.sourceId ?? input.classroom.id,
        recordingId: input.recordingId ?? existing.recordingId,
        locale: input.locale,
        title: safeTitle,
        generatedByAi: identified.generatedByAi,
        requiresReview: aiKindRequiresReview("recommendation"),
        payload: identified.payload,
        ...unpublishedAcademicFields(),
        updatedAt: now,
      })
      .where(eq(aiJobs.id, existing.id));
    await writeAuditLog({
      actor,
      action: "ai.recommendation.updated",
      entityType: "ai_job",
      entityId: existing.id,
      ipAddress: input.ip,
      metadata: {
        classroomId: input.classroom.id,
        locale: input.locale,
        generatedByAi: input.generatedByAi,
      },
    });
    return existing.id;
  }
  const [job] = await db
    .insert(aiJobs)
    .values({
      kind: "recommendation",
      status: "needs_review",
      sourceType: "classroom",
      sourceId: input.sourceId ?? input.classroom.id,
      classroomId: input.classroom.id,
      recordingId: input.recordingId ?? null,
      locale: input.locale,
      title: safeTitle,
      generatedByAi: identified.generatedByAi,
      requiresReview: aiKindRequiresReview("recommendation"),
      payload: identified.payload,
      createdByUserId: actor.userId,
      updatedAt: now,
    })
    .returning();
  if (!job) throw new ApiError(500, "SERVER", "Recommendation draft could not be created");
  await writeAuditLog({
    actor,
    action: "ai.recommendation.created",
    entityType: "ai_job",
    entityId: job.id,
    ipAddress: input.ip,
    metadata: {
      classroomId: input.classroom.id,
      locale: input.locale,
      generatedByAi: input.generatedByAi,
    },
  });
  return job.id;
}

function supportView(job: typeof aiJobs.$inferSelect): AiSupportView {
  return {
    id: job.id,
    query: payloadSupportQuery(job.payload),
    locale: asLocale(job.locale),
    status: asStatus(job.status),
    generatedByAi: aiContentIsIdentified(viewOrigin(job)) || job.generatedByAi,
    origin: viewOrigin(job),
    body: payloadSupportBody(job.payload),
    hits: payloadSupportHits(job.payload),
    createdAt: job.createdAt.toISOString(),
  };
}

async function loadSupportJobs(actorUserId: string, locale?: AiLocale | "all") {
  const rows = await db
    .select()
    .from(aiJobs)
    .where(
      and(
        eq(aiJobs.kind, "support"),
        eq(aiJobs.createdByUserId, actorUserId),
        locale && locale !== "all" ? eq(aiJobs.locale, locale) : undefined,
      ),
    )
    .orderBy(desc(aiJobs.createdAt))
    .limit(8);
  return rows.map(supportView);
}

async function collectSupportSources(
  actor: ApiActor,
  locale: AiLocale,
  studentUserId?: string,
) {
  const deskHref = aiPath(actor, studentUserId);
  const sources = platformSupportSources({
    role: actorSpeakerRole(actor),
    locale,
  });
  const docs = await listPublishedCmsForLocale(locale, ["faq", "page", "policy"]);
  for (const doc of docs) {
    const body = [doc.excerpt, doc.body].filter(Boolean).join(" ");
    if (!body.trim()) continue;
    sources.push({
      kind: doc.type === "faq" ? "faq" : "page",
      title: doc.title,
      body,
      href: doc.href,
    });
  }
  const classroomIds = await visibleClassroomIds(actor, studentUserId);
  if (!classroomIds.length) return sources;
  const rooms = await db
    .select({ id: classrooms.id, title: classrooms.title })
    .from(classrooms)
    .where(inArray(classrooms.id, classroomIds));
  const titleByRoom = new Map(rooms.map((row) => [row.id, row.title]));
  const transcriptRows = await db
    .select({
      job: aiJobs,
      transcript: aiTranscripts,
    })
    .from(aiTranscripts)
    .innerJoin(aiJobs, eq(aiTranscripts.jobId, aiJobs.id))
    .where(
      and(
        inArray(aiTranscripts.classroomId, classroomIds),
        eq(aiJobs.kind, "transcription"),
        eq(aiJobs.status, "approved"),
        eq(aiJobs.locale, locale),
      ),
    )
    .orderBy(desc(aiJobs.createdAt))
    .limit(20);
  for (const row of transcriptRows) {
    if (!row.transcript.fullText.trim()) continue;
    sources.push({
      kind: "transcript",
      title: titleByRoom.get(row.transcript.classroomId) || row.job.title,
      body: row.transcript.fullText,
      href: deskHref,
    });
  }
  const [summaries, homeworks, quizzes, recommendations] = await Promise.all([
    loadSummaryJobs(classroomIds, true, ""),
    loadHomeworkJobs(classroomIds, true, ""),
    loadQuizJobs(classroomIds, true, ""),
    loadRecommendationJobs(classroomIds, true, ""),
  ]);
  for (const job of summaries) {
    if (asLocale(job.locale) !== locale) continue;
    const body = [
      payloadSummaryBody(job.payload),
      ...payloadKeyPoints(job.payload),
    ].join(" ");
    if (!body.trim()) continue;
    sources.push({
      kind: "summary",
      title: titleByRoom.get(job.classroomId ?? "") || job.title,
      body,
      href: deskHref,
    });
  }
  for (const job of homeworks) {
    if (asLocale(job.locale) !== locale) continue;
    const body = [payloadHomeworkTitle(job.payload), payloadHomeworkBody(job.payload)].join(" ");
    if (!body.trim()) continue;
    sources.push({
      kind: "homework",
      title: payloadHomeworkTitle(job.payload) || job.title,
      body,
      href: deskHref,
    });
  }
  for (const job of quizzes) {
    if (asLocale(job.locale) !== locale) continue;
    const body = [payloadQuizTitle(job.payload), payloadQuizBody(job.payload)].join(" ");
    if (!body.trim()) continue;
    sources.push({
      kind: "quiz",
      title: payloadQuizTitle(job.payload) || job.title,
      body,
      href: deskHref,
    });
  }
  for (const job of recommendations) {
    if (asLocale(job.locale) !== locale) continue;
    const body = [
      payloadRecommendationTitle(job.payload),
      payloadRecommendationBody(job.payload),
    ].join(" ");
    if (!body.trim()) continue;
    sources.push({
      kind: "recommendation",
      title: payloadRecommendationTitle(job.payload) || job.title,
      body,
      href: deskHref,
    });
  }
  return sources;
}

async function writeSupportJob(
  actor: ApiActor,
  input: {
    locale: AiLocale;
    query: string;
    body: string;
    hits: AiSupportHit[];
    ip: string;
  },
) {
  const safe = requireAiSafeFields(
    [input.query, input.body, ...input.hits.map((hit) => `${hit.title} ${hit.excerpt}`)],
    "filter",
  );
  const query = safe.texts[0] ?? input.query;
  const body = safe.texts[1] ?? input.body;
  const hits = input.hits.map((hit, index) => {
    const combined = safe.texts[2 + index] ?? `${hit.title} ${hit.excerpt}`;
    const title = combined.slice(0, hit.title.length) || hit.title;
    return { ...hit, title: title.slice(0, 160), excerpt: hit.excerpt };
  });
  const now = new Date();
  const payload = {
    query: query.slice(0, 240),
    body: body.slice(0, 1200),
    hits,
    engine: "extractive",
    language: input.locale,
    safety: aiSafetyPayload(safe.filtered),
  };
  const identified = applyAiIdentification(payload, true);
  const [job] = await db
    .insert(aiJobs)
    .values({
      kind: "support",
      status: "ready",
      sourceType: "topic",
      locale: input.locale,
      title: query.slice(0, 180) || "Support search",
      generatedByAi: identified.generatedByAi,
      requiresReview: false,
      payload: identified.payload,
      createdByUserId: actor.userId,
      publishedAt: now,
      updatedAt: now,
    })
    .returning();
  if (!job) throw new ApiError(500, "SERVER", "Support answer could not be created");
  await writeAuditLog({
    actor,
    action: "ai.support.asked",
    entityType: "ai_job",
    entityId: job.id,
    ipAddress: input.ip,
    metadata: { locale: input.locale, hits: hits.length },
  });
  return job.id;
}

export async function getAiSystemsDesk(
  actor: ApiActor,
  options?: { studentUserId?: string; q?: string; locale?: AiLocale | "all" },
): Promise<AiSystemsDesk> {
  if (options?.studentUserId) {
    await assertCanViewStudent(actor, options.studentUserId);
  }
  const classroomIds = await visibleClassroomIds(actor, options?.studentUserId);
  const rooms = classroomIds.length
    ? await db
        .select({
          id: classrooms.id,
          title: classrooms.title,
          subjectSlug: classrooms.subjectSlug,
        })
        .from(classrooms)
        .where(inArray(classrooms.id, classroomIds))
        .orderBy(desc(classrooms.updatedAt))
    : [];
  const recordingRows = classroomIds.length
    ? await db
        .select({
          id: recordings.id,
          classroomId: recordings.classroomId,
          status: recordings.status,
        })
        .from(recordings)
        .where(inArray(recordings.classroomId, classroomIds))
        .orderBy(desc(recordings.startedAt))
    : [];
  const recordingByRoom = new Map<string, { id: string; ready: boolean }>();
  for (const row of recordingRows) {
    if (!recordingByRoom.has(row.classroomId)) {
      recordingByRoom.set(row.classroomId, {
        id: row.id,
        ready: row.status === "ready",
      });
    }
  }
  const approvedOnly = !canEditAi(actor);
  const query = options?.q?.trim() ?? "";
  const pattern = query ? transcriptSearchPattern(query) : "";
  const titleByRoom = new Map(rooms.map((row) => [row.id, row.title]));
  const visibility = [
    classroomIds.length ? inArray(aiJobs.classroomId, classroomIds) : undefined,
    eq(aiJobs.kind, "transcription"),
    approvedOnly ? eq(aiJobs.status, "approved") : undefined,
  ].filter(Boolean);
  let jobRows: (typeof aiJobs.$inferSelect)[] = [];
  let transcriptRows: (typeof aiTranscripts.$inferSelect)[] = [];
  if (classroomIds.length && pattern) {
    const searchRows = await db
      .select({
        transcript: aiTranscripts,
        job: aiJobs,
      })
      .from(aiTranscripts)
      .innerJoin(aiJobs, eq(aiTranscripts.jobId, aiJobs.id))
      .innerJoin(classrooms, eq(aiTranscripts.classroomId, classrooms.id))
      .where(
        and(
          inArray(aiTranscripts.classroomId, classroomIds),
          eq(aiJobs.kind, "transcription"),
          approvedOnly ? eq(aiJobs.status, "approved") : undefined,
          or(
            ilike(aiTranscripts.fullText, pattern),
            ilike(aiJobs.title, pattern),
            ilike(classrooms.title, pattern),
            sql`${aiTranscripts.segments}::text ilike ${pattern}`,
          ),
        ),
      )
      .orderBy(desc(aiJobs.createdAt))
      .limit(80);
    jobRows = searchRows.map((row) => row.job);
    transcriptRows = searchRows.map((row) => row.transcript);
  } else if (classroomIds.length) {
    jobRows = await db
      .select()
      .from(aiJobs)
      .where(visibility.length === 1 ? visibility[0] : and(...visibility))
      .orderBy(desc(aiJobs.createdAt))
      .limit(40);
    const jobIds = jobRows.map((row) => row.id);
    transcriptRows = jobIds.length
      ? await db
          .select()
          .from(aiTranscripts)
          .where(inArray(aiTranscripts.jobId, jobIds))
      : [];
  }
  const transcripts = transcriptRows
    .map((row) => {
      const job = jobRows.find((item) => item.id === row.jobId);
      if (!job) return null;
      const classroomTitle = titleByRoom.get(row.classroomId) || job.title;
      const segments = row.segments ?? [];
      const speakers = speakersFrom(segments);
      const matches = countTranscriptQueryMatches(
        { classroomTitle, fullText: row.fullText, segments },
        query,
      );
      const view: AiTranscriptView = {
        id: row.id,
        jobId: job.id,
        classroomId: row.classroomId,
        classroomTitle,
        recordingId: row.recordingId,
        locale: asLocale(row.locale),
        status: asStatus(job.status),
        source: payloadSource(job.payload),
        origin: viewOrigin(job),
        generatedByAi: aiContentIsIdentified(viewOrigin(job)) || row.generatedByAi,
        speakerCount: speakers.length,
        identifiedSpeakerCount: speakers.filter((item) => item.identified).length,
        speakers,
        fullText: row.fullText,
        segments,
        matchCount: matches.matchCount,
        matchedIndexes: matches.matchedIndexes,
        createdAt: row.createdAt.toISOString(),
        reviewedAt: job.reviewedAt?.toISOString() ?? null,
        publishedAt: job.publishedAt?.toISOString() ?? null,
      };
      return view;
    })
    .filter((row): row is AiTranscriptView => Boolean(row));
  const language = options?.locale ?? "all";
  const transcriptsForLanguage =
    language === "all"
      ? transcripts
      : transcripts.filter((row) => row.locale === language);
  const summaryRows = await loadSummaryJobs(classroomIds, approvedOnly, pattern);
  const summaries = summaryRows
    .filter((row) => row.classroomId)
    .map((row) =>
      summaryView(row, titleByRoom.get(row.classroomId!) || row.title),
    )
    .filter((row) => (language === "all" ? true : row.locale === language))
    .filter((row) =>
      query
        ? `${row.classroomTitle} ${row.body} ${row.keyPoints.join(" ")} ${row.vocabulary.join(" ")} ${row.improvementAreas.join(" ")} ${row.nextLessonRecommendations.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())
        : true,
    );
  const noteRows = canWriteNotes(actor)
    ? await loadNoteJobs(actor.userId, classroomIds)
    : [];
  const notes = noteRows
    .filter((row) => row.classroomId)
    .map((row) => noteView(row, titleByRoom.get(row.classroomId!) || row.title))
    .filter((row) => (language === "all" ? true : row.locale === language))
    .filter((row) =>
      query
        ? `${row.classroomTitle} ${row.body} ${row.bullets.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())
        : true,
    );
  const homeworkRows = await loadHomeworkJobs(classroomIds, approvedOnly, pattern);
  const homeworks = homeworkRows
    .filter((row) => row.classroomId)
    .map((row) =>
      homeworkView(row, titleByRoom.get(row.classroomId!) || row.title),
    )
    .filter((row) => (language === "all" ? true : row.locale === language))
    .filter((row) =>
      query
        ? `${row.classroomTitle} ${row.title} ${row.body} ${row.tasks.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())
        : true,
    );
  const quizRows = await loadQuizJobs(classroomIds, approvedOnly, pattern);
  const quizzes = quizRows
    .filter((row) => row.classroomId)
    .map((row) =>
      quizView(
        row,
        titleByRoom.get(row.classroomId!) || row.title,
        !canEditAi(actor),
      ),
    )
    .filter((row) => (language === "all" ? true : row.locale === language))
    .filter((row) =>
      query
        ? `${row.classroomTitle} ${row.title} ${row.body} ${row.sourceLabel} ${row.questions.map((item) => item.prompt).join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())
        : true,
    );
  const recommendationRows = await loadRecommendationJobs(
    classroomIds,
    approvedOnly,
    pattern,
  );
  const recommendations = recommendationRows
    .filter((row) => row.classroomId)
    .map((row) =>
      recommendationView(row, titleByRoom.get(row.classroomId!) || row.title),
    )
    .filter((row) => (language === "all" ? true : row.locale === language))
    .filter((row) =>
      query
        ? `${row.classroomTitle} ${row.title} ${row.body} ${row.sourceLabel} ${row.items.join(" ")} ${row.focus.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())
        : true,
    );
  const [books, topics, uploads, previousLessons] = await Promise.all([
    loadAiBooks(actor),
    loadAiTopics(actor),
    loadAiUploads(actor, classroomIds),
    loadAiPreviousLessons(actor, classroomIds),
  ]);
  return {
    href: aiPath(actor, options?.studentUserId),
    canEdit: canEditAi(actor),
    canWriteNotes: canWriteNotes(actor),
    query,
    studentUserId: options?.studentUserId,
    language,
    searchableLive: true,
    speakersLive: true,
    summariesLive: true,
    keyPointsLive: true,
    vocabularyLive: true,
    improvementAreasLive: true,
    nextLessonRecommendationsLive: true,
    notesLive: true,
    homeworkLive: true,
    quizLive: true,
    recommendationsLive: true,
    reviewLive: true,
    identificationLive: true,
    decisionsLive: true,
    architectureLive: true,
    architecture: getAiArchitecture(),
    supportLive: true,
    actorUserId: actor.userId,
    actorName: actorSpeakerName(actor),
    actorRole: actorSpeakerRole(actor),
    englishLive: true,
    arabicLive: true,
    safety: {
      labelled: true,
      noAutonomousAcademic: true,
      noAutonomousSafeguarding: true,
      reviewRequired: true,
      contactBlocked: true,
      paymentHidden: true,
      extractiveOnly: true,
      controlsLive: true,
      controls: [...AI_SAFETY_CONTROLS],
    },
    decisions: {
      live: true,
      autonomous: false,
      academicBlocked: true,
      safeguardingBlocked: true,
      forbidden: [...AI_FORBIDDEN_AUTONOMOUS_DECISIONS],
    },
    modules: [
      ...listLiveAiCapabilityModules(),
      ...listPlannedAiModules(),
    ],
    classrooms: rooms.map((row) => ({
      id: row.id,
      title: row.title,
      subjectSlug: row.subjectSlug,
      recordingId: recordingByRoom.get(row.id)?.id ?? null,
      recordingReady: recordingByRoom.get(row.id)?.ready ?? false,
    })),
    transcripts: transcriptsForLanguage,
    summaries,
    notes,
    supports: await loadSupportJobs(actor.userId, language),
    homeworks,
    quizzes,
    recommendations,
    books,
    topics,
    uploads,
    previousLessons,
    reviewQueue: canEditAi(actor)
      ? [
          ...transcriptsForLanguage
            .filter((item) => aiJobIsPendingReview(item.status))
            .map((item) => ({
              jobId: item.jobId,
              kind: "transcription" as const,
              classroomId: item.classroomId,
              classroomTitle: item.classroomTitle,
              locale: item.locale,
              status: item.status,
              generatedByAi: item.generatedByAi,
              origin: item.origin,
              title: item.classroomTitle,
              excerpt: reviewExcerpt(item.fullText),
              createdAt: item.createdAt,
            })),
          ...summaries
            .filter((item) => aiJobIsPendingReview(item.status))
            .map((item) => ({
              jobId: item.id,
              kind: "summary" as const,
              classroomId: item.classroomId,
              classroomTitle: item.classroomTitle,
              locale: item.locale,
              status: item.status,
              generatedByAi: item.generatedByAi,
              origin: item.origin,
              title: item.classroomTitle,
              excerpt: reviewExcerpt(item.body),
              createdAt: item.createdAt,
            })),
          ...homeworks
            .filter((item) => aiJobIsPendingReview(item.status))
            .map((item) => ({
              jobId: item.id,
              kind: "homework" as const,
              classroomId: item.classroomId,
              classroomTitle: item.classroomTitle,
              locale: item.locale,
              status: item.status,
              generatedByAi: item.generatedByAi,
              origin: item.origin,
              title: item.title,
              excerpt: reviewExcerpt(item.body || item.tasks.join(" ")),
              createdAt: item.createdAt,
            })),
          ...quizzes
            .filter((item) => aiJobIsPendingReview(item.status))
            .map((item) => ({
              jobId: item.id,
              kind: "quiz" as const,
              classroomId: item.classroomId,
              classroomTitle: item.classroomTitle,
              locale: item.locale,
              status: item.status,
              generatedByAi: item.generatedByAi,
              origin: item.origin,
              title: item.title,
              excerpt: reviewExcerpt(
                item.body || item.questions.map((question) => question.prompt).join(" "),
              ),
              createdAt: item.createdAt,
            })),
          ...recommendations
            .filter((item) => aiJobIsPendingReview(item.status))
            .map((item) => ({
              jobId: item.id,
              kind: "recommendation" as const,
              classroomId: item.classroomId,
              classroomTitle: item.classroomTitle,
              locale: item.locale,
              status: item.status,
              generatedByAi: item.generatedByAi,
              origin: item.origin,
              title: item.title,
              excerpt: reviewExcerpt(item.body || item.items.join(" ")),
              createdAt: item.createdAt,
            })),
        ].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      : [],
  };
}

export async function saveAiSystemsDesk(
  actor: ApiActor,
  input:
    | {
        action: "transcribe";
        classroomId: string;
        recordingId?: string;
        locale?: AiLocale;
      }
    | {
        action: "save_text";
        classroomId: string;
        recordingId?: string;
        locale?: AiLocale;
        body: string;
      }
    | {
        action: "review";
        jobId: string;
        decision: "approve" | "reject";
        note?: string;
      }
    | {
        action: "relabel";
        jobId: string;
        segmentIndex: number;
        speakerRole: AiSpeakerRole;
        speakerName: string;
      }
    | {
        action: "save_speech";
        classroomId: string;
        recordingId?: string;
        locale?: AiLocale;
        finalize?: boolean;
        segments: {
          body: string;
          at?: string;
          startMs?: number;
          confidence?: number;
          speakerRole?: string;
          speakerName?: string;
          speakerUserId?: string;
        }[];
      }
    | {
        action: "summarise";
        transcriptJobId: string;
      }
    | {
        action: "save_summary";
        classroomId: string;
        locale?: AiLocale;
        transcriptJobId?: string;
        body: string;
        keyPoints?: string;
        vocabulary?: string;
        improvementAreas?: string;
        nextLessonRecommendations?: string;
      }
    | {
        action: "save_key_points";
        jobId: string;
        keyPoints: string;
      }
    | {
        action: "save_vocabulary";
        jobId: string;
        vocabulary: string;
      }
    | {
        action: "save_improvement_areas";
        jobId: string;
        improvementAreas: string;
      }
    | {
        action: "save_next_recommendations";
        jobId: string;
        nextLessonRecommendations: string;
      }
    | {
        action: "save_notes";
        transcriptJobId: string;
      }
    | {
        action: "save_typed_notes";
        classroomId: string;
        locale?: AiLocale;
        transcriptJobId?: string;
        body: string;
      }
    | {
        action: "update_notes";
        jobId: string;
        body: string;
      }
    | {
        action: "generate_homework";
        transcriptJobId: string;
      }
    | {
        action: "save_typed_homework";
        classroomId: string;
        locale?: AiLocale;
        transcriptJobId?: string;
        title: string;
        body: string;
        tasks?: string;
      }
    | {
        action: "update_homework";
        jobId: string;
        title: string;
        body: string;
        tasks?: string;
      }
    | {
        action: "generate_quiz_lesson";
        transcriptJobId: string;
      }
    | {
        action: "generate_quiz_book";
        materialId: string;
        classroomId: string;
        locale?: AiLocale;
      }
    | {
        action: "generate_quiz_topic";
        topic: string;
        classroomId: string;
        locale?: AiLocale;
      }
    | {
        action: "generate_quiz_upload";
        fileId: string;
        classroomId: string;
        locale?: AiLocale;
      }
    | {
        action: "generate_quiz_previous";
        previousClassroomId: string;
        classroomId: string;
        locale?: AiLocale;
      }
    | {
        action: "save_typed_quiz";
        classroomId: string;
        locale?: AiLocale;
        title: string;
        body: string;
        questions?: string;
      }
    | {
        action: "update_quiz";
        jobId: string;
        title: string;
        body: string;
        questions?: string;
      }
    | {
        action: "generate_recommendation";
        transcriptJobId: string;
      }
    | {
        action: "generate_recommendation_previous";
        previousClassroomId: string;
        classroomId: string;
        locale?: AiLocale;
      }
    | {
        action: "save_typed_recommendation";
        classroomId: string;
        locale?: AiLocale;
        title: string;
        body: string;
        items?: string;
      }
    | {
        action: "update_recommendation";
        jobId: string;
        title: string;
        body: string;
        items?: string;
      }
    | {
        action: "ask_support";
        query: string;
        locale?: AiLocale;
      },
  ip: string,
) {
  assertAiActionModule(input.action);
  if (input.action === "ask_support") {
    const locale = input.locale ?? "en";
    const query = input.query.trim();
    requireAiSafeText(query, "reject");
    const refusal = refuseAutonomousSensitiveDecision(query);
    if (refusal) {
      throw new ApiError(422, "AI_SAFETY", refusal);
    }
    const draft = runAiModule.support({
      query,
      locale,
      sources: await collectSupportSources(actor, locale),
    });
    await writeSupportJob(actor, {
      locale,
      query,
      body: draft.body,
      hits: draft.hits,
      ip,
    });
    return getAiSystemsDesk(actor, { locale });
  }
  if (input.action === "review") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can review AI work");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.jobId))
      .limit(1);
    if (!job?.classroomId) {
      throw new ApiError(404, "NOT_FOUND", "AI job not found");
    }
    if (!isAcademicAiKind(job.kind) || !job.requiresReview) {
      throw new ApiError(
        400,
        "VALIDATION",
        "Private notes and search do not need teacher review",
      );
    }
    if (!aiJobIsPendingReview(asStatus(job.status), job.requiresReview)) {
      throw new ApiError(
        400,
        "VALIDATION",
        job.status === "approved"
          ? "This AI work has already been published"
          : "Only unpublished AI work can be reviewed",
      );
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only review AI work for your lessons");
    }
    let transcriptText = "";
    if (job.kind === "transcription") {
      const [transcript] = await db
        .select({ fullText: aiTranscripts.fullText })
        .from(aiTranscripts)
        .where(eq(aiTranscripts.jobId, job.id))
        .limit(1);
      transcriptText = transcript?.fullText ?? "";
    }
    const approved = input.decision === "approve";
    if (approved && !academicJobHasPublishableContent(job, transcriptText)) {
      throw new ApiError(
        400,
        "VALIDATION",
        "This draft is too short to publish for learners",
      );
    }
    const now = new Date();
    const note = input.note?.trim();
    if (note) requireAiSafeText(note, "reject");
    const decisionText = collectDecisionScanText({
      title: job.title,
      transcript: transcriptText,
      payload: job.payload,
      note,
    });
    if (approved) {
      const refusal = refuseAutonomousSensitiveDecision(decisionText);
      if (refusal) {
        throw new ApiError(422, "AI_SAFETY", refusal);
      }
    }
    await db
      .update(aiJobs)
      .set({
        status: approved ? "approved" : "rejected",
        reviewedByUserId: actor.userId,
        reviewedAt: now,
        publishedAt: approved ? now : null,
        payload: {
          ...(job.payload ?? {}),
          reviewNote: note || null,
          decisions: aiDecisionPayload(),
        },
        updatedAt: now,
      })
      .where(eq(aiJobs.id, job.id));
    await writeAuditLog({
      actor,
      action: approved ? "ai.job.approved" : "ai.job.rejected",
      entityType: "ai_job",
      entityId: job.id,
      ipAddress: ip,
      metadata: {
        kind: job.kind,
        classroomId: job.classroomId,
        published: approved,
        note: note || undefined,
      },
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "relabel") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can label speakers");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.jobId))
      .limit(1);
    if (!job?.classroomId) {
      throw new ApiError(404, "NOT_FOUND", "AI job not found");
    }
    if (job.status !== "needs_review" && job.status !== "processing") {
      throw new ApiError(400, "VALIDATION", "Only open transcripts can have speakers relabelled");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only label speakers on your lessons");
    }
    const [row] = await db
      .select()
      .from(aiTranscripts)
      .where(eq(aiTranscripts.jobId, job.id))
      .limit(1);
    const segments = [...(row?.segments ?? [])];
    const current = segments[input.segmentIndex];
    if (!row || !current) {
      throw new ApiError(400, "VALIDATION", "That transcript line could not be labelled");
    }
    segments[input.segmentIndex] = {
      ...current,
      speakerRole: input.speakerRole,
      speakerName: input.speakerName.trim(),
    };
    const speakers = speakersFrom(segments);
    const now = new Date();
    await db
      .update(aiJobs)
      .set({
        payload: {
          ...(job.payload ?? {}),
          speakerCount: speakers.length,
          identifiedSpeakerCount: speakers.filter((item) => item.identified).length,
        },
        updatedAt: now,
      })
      .where(eq(aiJobs.id, job.id));
    await db
      .update(aiTranscripts)
      .set({
        fullText: fullTextFrom(segments),
        speakerCount: speakers.length,
        segments,
        updatedAt: now,
      })
      .where(eq(aiTranscripts.id, row.id));
    await writeAuditLog({
      actor,
      action: "ai.transcription.relabel",
      entityType: "ai_job",
      entityId: job.id,
      ipAddress: ip,
      metadata: {
        classroomId: job.classroomId,
        segmentIndex: input.segmentIndex,
        speakerRole: input.speakerRole,
      },
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "summarise") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can write lesson summaries");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.transcriptJobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "transcription") {
      throw new ApiError(404, "NOT_FOUND", "Transcript not found");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    const [transcript] = await db
      .select()
      .from(aiTranscripts)
      .where(eq(aiTranscripts.jobId, job.id))
      .limit(1);
    if (!transcript?.fullText.trim()) {
      throw new ApiError(400, "VALIDATION", "This transcript has no text to summarise");
    }
    const locale = asLocale(transcript.locale || job.locale);
    const draft = runAiModule.summarise({
      fullText: transcript.fullText,
      segments: transcript.segments ?? [],
      locale,
    });
    await writeSummaryJob(actor, {
      classroom,
      locale,
      body: draft.body,
      generatedByAi: true,
      transcriptJobId: job.id,
      recordingId: transcript.recordingId ?? job.recordingId,
      sentenceCount: draft.sentenceCount,
      keyPoints: draft.keyPoints,
      vocabulary: draft.vocabulary,
      improvementAreas: draft.improvementAreas,
      nextLessonRecommendations: draft.nextLessonRecommendations,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "save_summary") {
    const classroom = await requireVisibleClassroom(actor, input.classroomId);
    const locale = input.locale ?? "en";
    const prepared =
      locale === "ar"
        ? normaliseArabicTranscript(input.body)
        : normaliseEnglishTranscript(input.body);
    const typedPoints = input.keyPoints
      ? parseTypedKeyPoints(input.keyPoints, locale)
      : runAiModule.keyPoints({ fullText: prepared, locale });
    const typedVocabulary = input.vocabulary
      ? parseTypedVocabulary(input.vocabulary, locale)
      : runAiModule.vocabulary({ fullText: prepared, locale });
    const typedImprovements = input.improvementAreas
      ? parseTypedImprovementAreas(input.improvementAreas, locale)
      : runAiModule.improvementAreas({ fullText: prepared, locale });
    const typedNext = input.nextLessonRecommendations
      ? parseTypedNextLessonRecommendations(input.nextLessonRecommendations, locale)
      : runAiModule.nextLesson({ fullText: prepared, locale });
    await writeSummaryJob(actor, {
      classroom,
      locale,
      body: prepared,
      generatedByAi: false,
      transcriptJobId: input.transcriptJobId,
      recordingId: await latestRecordingId(classroom.id),
      sentenceCount: splitCount(prepared),
      keyPoints: typedPoints,
      vocabulary: typedVocabulary,
      improvementAreas: typedImprovements,
      nextLessonRecommendations: typedNext,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "save_key_points") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can edit key learning points");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.jobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "summary") {
      throw new ApiError(404, "NOT_FOUND", "Lesson summary not found");
    }
    if (job.status !== "needs_review" && job.status !== "processing") {
      throw new ApiError(400, "VALIDATION", "Only open summaries can have key points edited");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only edit key points on your lessons");
    }
    const locale = asLocale(job.locale);
    const keyPoints = parseTypedKeyPoints(input.keyPoints, locale);
    requireAiSafeFields(keyPoints, "reject");
    const now = new Date();
    const identified = applyAiIdentification(
      { ...(job.payload ?? {}), keyPoints },
      false,
      job,
    );
    await db
      .update(aiJobs)
      .set({
        generatedByAi: identified.generatedByAi,
        payload: identified.payload,
        updatedAt: now,
      })
      .where(eq(aiJobs.id, job.id));
    await writeAuditLog({
      actor,
      action: "ai.summary.keypoints",
      entityType: "ai_job",
      entityId: job.id,
      ipAddress: ip,
      metadata: { classroomId: job.classroomId, count: keyPoints.length },
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "save_vocabulary") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can edit vocabulary");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.jobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "summary") {
      throw new ApiError(404, "NOT_FOUND", "Lesson summary not found");
    }
    if (job.status !== "needs_review" && job.status !== "processing") {
      throw new ApiError(400, "VALIDATION", "Only open summaries can have vocabulary edited");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only edit vocabulary on your lessons");
    }
    const locale = asLocale(job.locale);
    const vocabulary = parseTypedVocabulary(input.vocabulary, locale);
    requireAiSafeFields(vocabulary, "reject");
    const now = new Date();
    const identified = applyAiIdentification(
      { ...(job.payload ?? {}), vocabulary },
      false,
      job,
    );
    await db
      .update(aiJobs)
      .set({
        generatedByAi: identified.generatedByAi,
        payload: identified.payload,
        updatedAt: now,
      })
      .where(eq(aiJobs.id, job.id));
    await writeAuditLog({
      actor,
      action: "ai.summary.vocabulary",
      entityType: "ai_job",
      entityId: job.id,
      ipAddress: ip,
      metadata: { classroomId: job.classroomId, count: vocabulary.length },
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "save_improvement_areas") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can edit improvement areas");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.jobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "summary") {
      throw new ApiError(404, "NOT_FOUND", "Lesson summary not found");
    }
    if (job.status !== "needs_review" && job.status !== "processing") {
      throw new ApiError(400, "VALIDATION", "Only open summaries can have improvement areas edited");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only edit improvement areas on your lessons");
    }
    const locale = asLocale(job.locale);
    const improvementAreas = parseTypedImprovementAreas(input.improvementAreas, locale);
    requireAiSafeFields(improvementAreas, "reject");
    const now = new Date();
    const identified = applyAiIdentification(
      { ...(job.payload ?? {}), improvementAreas },
      false,
      job,
    );
    await db
      .update(aiJobs)
      .set({
        generatedByAi: identified.generatedByAi,
        payload: identified.payload,
        updatedAt: now,
      })
      .where(eq(aiJobs.id, job.id));
    await writeAuditLog({
      actor,
      action: "ai.summary.improvements",
      entityType: "ai_job",
      entityId: job.id,
      ipAddress: ip,
      metadata: { classroomId: job.classroomId, count: improvementAreas.length },
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "save_next_recommendations") {
    if (!canEditAi(actor)) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only teachers and staff can edit next-lesson recommendations",
      );
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.jobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "summary") {
      throw new ApiError(404, "NOT_FOUND", "Lesson summary not found");
    }
    if (job.status !== "needs_review" && job.status !== "processing") {
      throw new ApiError(
        400,
        "VALIDATION",
        "Only open summaries can have next-lesson recommendations edited",
      );
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "You can only edit next-lesson recommendations on your lessons",
      );
    }
    const locale = asLocale(job.locale);
    const nextLessonRecommendations = parseTypedNextLessonRecommendations(
      input.nextLessonRecommendations,
      locale,
    );
    requireAiSafeFields(nextLessonRecommendations, "reject");
    const now = new Date();
    const identified = applyAiIdentification(
      { ...(job.payload ?? {}), nextLessonRecommendations },
      false,
      job,
    );
    await db
      .update(aiJobs)
      .set({
        generatedByAi: identified.generatedByAi,
        payload: identified.payload,
        updatedAt: now,
      })
      .where(eq(aiJobs.id, job.id));
    await writeAuditLog({
      actor,
      action: "ai.summary.next",
      entityType: "ai_job",
      entityId: job.id,
      ipAddress: ip,
      metadata: { classroomId: job.classroomId, count: nextLessonRecommendations.length },
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "save_notes") {
    if (!canWriteNotes(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only learners, teachers, and staff can keep private notes");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.transcriptJobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "transcription") {
      throw new ApiError(404, "NOT_FOUND", "Transcript not found");
    }
    if (actor.roleKey === "student" && job.status !== "approved") {
      throw new ApiError(403, "FORBIDDEN", "You can only write notes from an approved transcript");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    const [transcript] = await db
      .select()
      .from(aiTranscripts)
      .where(eq(aiTranscripts.jobId, job.id))
      .limit(1);
    if (!transcript?.fullText.trim()) {
      throw new ApiError(400, "VALIDATION", "This transcript has no text for notes");
    }
    const locale = asLocale(transcript.locale || job.locale);
    const draft = runAiModule.notes({
      fullText: transcript.fullText,
      segments: transcript.segments ?? [],
      locale,
    });
    await writeNoteJob(actor, {
      classroom,
      locale,
      body: draft.body,
      bullets: draft.bullets,
      generatedByAi: true,
      transcriptJobId: job.id,
      recordingId: transcript.recordingId ?? job.recordingId,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "save_typed_notes") {
    if (!canWriteNotes(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only learners, teachers, and staff can keep private notes");
    }
    const classroom = await requireVisibleClassroom(actor, input.classroomId);
    const locale = input.locale ?? "en";
    const typed = parseTypedNotes(input.body, locale);
    await writeNoteJob(actor, {
      classroom,
      locale,
      body: typed.body,
      bullets: typed.bullets,
      generatedByAi: false,
      transcriptJobId: input.transcriptJobId,
      recordingId: await latestRecordingId(classroom.id),
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "update_notes") {
    if (!canWriteNotes(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only learners, teachers, and staff can keep private notes");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.jobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "notes") {
      throw new ApiError(404, "NOT_FOUND", "Lesson notes not found");
    }
    if (job.createdByUserId !== actor.userId) {
      throw new ApiError(403, "FORBIDDEN", "You can only edit your own private notes");
    }
    await requireVisibleClassroom(actor, job.classroomId);
    const locale = asLocale(job.locale);
    const typed = parseTypedNotes(input.body, locale);
    requireAiSafeFields([typed.body, ...typed.bullets], "reject");
    const now = new Date();
    const identified = applyAiIdentification(
      {
        ...(job.payload ?? {}),
        body: typed.body,
        bullets: typed.bullets,
      },
      false,
      job,
    );
    await db
      .update(aiJobs)
      .set({
        generatedByAi: identified.generatedByAi,
        payload: identified.payload,
        updatedAt: now,
      })
      .where(eq(aiJobs.id, job.id));
    await writeAuditLog({
      actor,
      action: "ai.notes.updated",
      entityType: "ai_job",
      entityId: job.id,
      ipAddress: ip,
      metadata: { classroomId: job.classroomId },
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "generate_homework") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate homework");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.transcriptJobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "transcription") {
      throw new ApiError(404, "NOT_FOUND", "Transcript not found");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only generate homework for your own lessons");
    }
    const [transcript] = await db
      .select()
      .from(aiTranscripts)
      .where(eq(aiTranscripts.jobId, job.id))
      .limit(1);
    if (!transcript?.fullText.trim()) {
      throw new ApiError(400, "VALIDATION", "This transcript has no text for homework");
    }
    const locale = asLocale(transcript.locale || job.locale);
    const draft = runAiModule.homework({
      fullText: transcript.fullText,
      segments: transcript.segments ?? [],
      locale,
      classroomTitle: classroom.title,
    });
    await writeHomeworkJob(actor, {
      classroom,
      locale,
      title: draft.title,
      body: draft.body,
      tasks: draft.tasks,
      generatedByAi: true,
      transcriptJobId: job.id,
      recordingId: transcript.recordingId ?? job.recordingId,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "save_typed_homework") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate homework");
    }
    const classroom = await requireVisibleClassroom(actor, input.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only generate homework for your own lessons");
    }
    const locale = input.locale ?? "en";
    const typed = parseTypedHomework({
      title: input.title,
      body: input.body,
      tasks: input.tasks,
      locale,
    });
    await writeHomeworkJob(actor, {
      classroom,
      locale,
      title: typed.title,
      body: typed.body,
      tasks: typed.tasks,
      generatedByAi: false,
      transcriptJobId: input.transcriptJobId,
      recordingId: await latestRecordingId(classroom.id),
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "update_homework") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate homework");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.jobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "homework") {
      throw new ApiError(404, "NOT_FOUND", "Homework draft not found");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only edit homework for your own lessons");
    }
    const locale = asLocale(job.locale);
    const typed = parseTypedHomework({
      title: input.title,
      body: input.body,
      tasks: input.tasks,
      locale,
    });
    requireAiSafeFields([typed.title, typed.body, ...typed.tasks], "reject");
    const now = new Date();
    const identified = applyAiIdentification(
      {
        ...(job.payload ?? {}),
        title: typed.title,
        body: typed.body,
        tasks: typed.tasks,
      },
      false,
      job,
    );
    await db
      .update(aiJobs)
      .set({
        status: "needs_review",
        title: typed.title,
        generatedByAi: identified.generatedByAi,
        requiresReview: true,
        payload: identified.payload,
        ...unpublishedAcademicFields(),
        updatedAt: now,
      })
      .where(eq(aiJobs.id, job.id));
    await writeAuditLog({
      actor,
      action: "ai.homework.updated",
      entityType: "ai_job",
      entityId: job.id,
      ipAddress: ip,
      metadata: { classroomId: job.classroomId },
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "generate_quiz_lesson") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate quizzes");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.transcriptJobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "transcription") {
      throw new ApiError(404, "NOT_FOUND", "Transcript not found");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only generate quizzes for your own lessons");
    }
    const [transcript] = await db
      .select()
      .from(aiTranscripts)
      .where(eq(aiTranscripts.jobId, job.id))
      .limit(1);
    if (!transcript?.fullText.trim()) {
      throw new ApiError(400, "VALIDATION", "This transcript has no text for a quiz");
    }
    const locale = asLocale(transcript.locale || job.locale);
    const draft = runAiModule.quiz({
      fullText: transcript.fullText,
      segments: transcript.segments ?? [],
      locale,
      title: classroom.title,
    });
    await writeQuizJob(actor, {
      classroom,
      locale,
      title: draft.title,
      body: draft.body,
      questions: draft.questions,
      generatedByAi: true,
      source: "lesson",
      sourceType: "classroom",
      sourceId: job.id,
      transcriptJobId: job.id,
      recordingId: transcript.recordingId ?? job.recordingId,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "generate_quiz_book") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate quizzes");
    }
    const classroom = await requireVisibleClassroom(actor, input.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only generate quizzes for your own lessons");
    }
    const [book] = await db
      .select({
        id: teachingMaterials.id,
        title: teachingMaterials.title,
        description: teachingMaterials.description,
        category: teachingMaterials.category,
        pages: teachingMaterials.pages,
        status: teachingMaterials.status,
        audience: teachingMaterials.audience,
        createdByUserId: teachingMaterials.createdByUserId,
      })
      .from(teachingMaterials)
      .where(eq(teachingMaterials.id, input.materialId))
      .limit(1);
    if (!book || !isLibraryBookCategory(book.category)) {
      throw new ApiError(404, "NOT_FOUND", "Book not found");
    }
    if (!canSeeAiBook(actor, book)) {
      throw new ApiError(403, "FORBIDDEN", "You cannot open this book for a quiz");
    }
    const locale = input.locale ?? "en";
    const fullText = bookSourceText(book.title, book.description, book.pages);
    if (fullText.trim().length < 20) {
      throw new ApiError(400, "VALIDATION", "This book has no readable text for a quiz");
    }
    const draft = runAiModule.quiz({
      fullText,
      locale,
      title: book.title,
    });
    await writeQuizJob(actor, {
      classroom,
      locale,
      title: draft.title,
      body: draft.body,
      questions: draft.questions,
      generatedByAi: true,
      source: "book",
      sourceType: "material",
      sourceId: book.id,
      materialId: book.id,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "generate_quiz_topic") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate quizzes");
    }
    const classroom = await requireVisibleClassroom(actor, input.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only generate quizzes for your own lessons");
    }
    const topic = input.topic.trim();
    const rows = await db
      .select({
        id: questionBankItems.id,
        prompt: questionBankItems.prompt,
        kind: questionBankItems.kind,
        topic: questionBankItems.topic,
        status: questionBankItems.status,
        body: questionBankItems.body,
        createdByUserId: questionBankItems.createdByUserId,
      })
      .from(questionBankItems)
      .where(ilike(questionBankItems.topic, topic))
      .orderBy(desc(questionBankItems.updatedAt))
      .limit(40);
    const visible = rows.filter((row) => {
      if (row.createdByUserId === actor.userId || isStaffAcademic(actor)) return true;
      return row.status === "published";
    });
    const questions = quizQuestionsFromBank(visible);
    if (!questions.length) {
      throw new ApiError(400, "VALIDATION", "No question-bank items match that topic");
    }
    const locale = input.locale ?? "en";
    await writeQuizJob(actor, {
      classroom,
      locale,
      title: topic.slice(0, 160),
      body: questions.map((item) => item.prompt).join(" ").slice(0, 2400),
      questions,
      generatedByAi: false,
      source: "topic",
      sourceType: "topic",
      sourceId: classroom.id,
      topic,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "generate_quiz_upload") {
    return generateQuizFromUploadedDocument(
      actor,
      {
        classroomId: input.classroomId,
        locale: input.locale,
        fileId: input.fileId,
      },
      ip,
    );
  }

  if (input.action === "generate_quiz_previous") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate quizzes");
    }
    if (input.previousClassroomId === input.classroomId) {
      throw new ApiError(
        400,
        "VALIDATION",
        "Choose a previous lesson that is different from this lesson",
      );
    }
    const [classroom, previous] = await Promise.all([
      requireVisibleClassroom(actor, input.classroomId),
      requireVisibleClassroom(actor, input.previousClassroomId),
    ]);
    if (actor.roleKey === "teacher") {
      if (actor.userId !== classroom.teacherUserId || actor.userId !== previous.teacherUserId) {
        throw new ApiError(403, "FORBIDDEN", "You can only generate quizzes for your own lessons");
      }
    }
    const locale = input.locale ?? "en";
    const source = await previousLessonSource(previous.id, locale);
    if (source.fullText.length < 20) {
      throw new ApiError(
        400,
        "VALIDATION",
        "That previous lesson has no readable transcript or summary for a quiz",
      );
    }
    const draft = runAiModule.quiz({
      fullText: source.fullText,
      locale,
      title: previous.title,
    });
    if (!draft.questions.length) {
      throw new ApiError(
        400,
        "VALIDATION",
        "That previous lesson has no extractable quiz questions",
      );
    }
    await writeQuizJob(actor, {
      classroom,
      locale,
      title: draft.title,
      body: draft.body,
      questions: draft.questions,
      generatedByAi: true,
      source: "previous",
      sourceType: "classroom",
      sourceId: previous.id,
      transcriptJobId: source.transcriptJobId,
      previousClassroomId: previous.id,
      previousTitle: previous.title,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "save_typed_quiz") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate quizzes");
    }
    const classroom = await requireVisibleClassroom(actor, input.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only generate quizzes for your own lessons");
    }
    const locale = input.locale ?? "en";
    const typed = parseTypedQuiz({
      title: input.title,
      body: input.body,
      questions: input.questions,
      locale,
    });
    await writeQuizJob(actor, {
      classroom,
      locale,
      title: typed.title,
      body: typed.body,
      questions: typed.questions,
      generatedByAi: false,
      source: "lesson",
      sourceType: "classroom",
      sourceId: classroom.id,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "update_quiz") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate quizzes");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.jobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "quiz") {
      throw new ApiError(404, "NOT_FOUND", "Quiz draft not found");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only edit quizzes for your own lessons");
    }
    const locale = asLocale(job.locale);
    const typed = parseTypedQuiz({
      title: input.title,
      body: input.body,
      questions: input.questions,
      locale,
    });
    const questions = input.questions?.trim()
      ? typed.questions
      : payloadQuizQuestions(job.payload);
    requireAiSafeFields(
      [typed.title, typed.body, ...questions.flatMap(quizQuestionSafetyFields)],
      "reject",
    );
    const now = new Date();
    const identified = applyAiIdentification(
      {
        ...(job.payload ?? {}),
        title: typed.title,
        body: typed.body,
        questions,
      },
      false,
      job,
    );
    await db
      .update(aiJobs)
      .set({
        status: "needs_review",
        title: typed.title,
        generatedByAi: identified.generatedByAi,
        requiresReview: true,
        payload: identified.payload,
        ...unpublishedAcademicFields(),
        updatedAt: now,
      })
      .where(eq(aiJobs.id, job.id));
    await writeAuditLog({
      actor,
      action: "ai.quiz.updated",
      entityType: "ai_job",
      entityId: job.id,
      ipAddress: ip,
      metadata: { classroomId: job.classroomId },
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "generate_recommendation") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate recommendations");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.transcriptJobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "transcription") {
      throw new ApiError(404, "NOT_FOUND", "Transcript not found");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "You can only generate recommendations for your own lessons",
      );
    }
    const [transcript] = await db
      .select()
      .from(aiTranscripts)
      .where(eq(aiTranscripts.jobId, job.id))
      .limit(1);
    if (!transcript?.fullText.trim()) {
      throw new ApiError(400, "VALIDATION", "This transcript has no text for a recommendation");
    }
    const locale = asLocale(transcript.locale || job.locale);
    const draft = runAiModule.recommendation({
      fullText: transcript.fullText,
      segments: transcript.segments ?? [],
      locale,
      title: classroom.title,
    });
    if (!draft.items.length) {
      throw new ApiError(
        400,
        "VALIDATION",
        "This transcript has no extractable learning recommendations",
      );
    }
    await writeRecommendationJob(actor, {
      classroom,
      locale,
      title: draft.title,
      body: draft.body,
      items: draft.items,
      focus: draft.focus,
      generatedByAi: true,
      sourceId: job.id,
      transcriptJobId: job.id,
      recordingId: transcript.recordingId ?? job.recordingId,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "generate_recommendation_previous") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate recommendations");
    }
    if (input.previousClassroomId === input.classroomId) {
      throw new ApiError(
        400,
        "VALIDATION",
        "Choose a previous lesson that is different from this lesson",
      );
    }
    const [classroom, previous] = await Promise.all([
      requireVisibleClassroom(actor, input.classroomId),
      requireVisibleClassroom(actor, input.previousClassroomId),
    ]);
    if (actor.roleKey === "teacher") {
      if (actor.userId !== classroom.teacherUserId || actor.userId !== previous.teacherUserId) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "You can only generate recommendations for your own lessons",
        );
      }
    }
    const locale = input.locale ?? "en";
    const source = await previousLessonSource(previous.id, locale);
    if (source.fullText.length < 20) {
      throw new ApiError(
        400,
        "VALIDATION",
        "That previous lesson has no readable transcript or summary for a recommendation",
      );
    }
    const draft = runAiModule.recommendation({
      fullText: source.fullText,
      locale,
      title: previous.title,
    });
    if (!draft.items.length) {
      throw new ApiError(
        400,
        "VALIDATION",
        "That previous lesson has no extractable learning recommendations",
      );
    }
    await writeRecommendationJob(actor, {
      classroom,
      locale,
      title: draft.title,
      body: draft.body,
      items: draft.items,
      focus: draft.focus,
      generatedByAi: true,
      sourceId: previous.id,
      transcriptJobId: source.transcriptJobId,
      previousClassroomId: previous.id,
      previousTitle: previous.title,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "save_typed_recommendation") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate recommendations");
    }
    const classroom = await requireVisibleClassroom(actor, input.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "You can only generate recommendations for your own lessons",
      );
    }
    const locale = input.locale ?? "en";
    const typed = parseTypedRecommendation({
      title: input.title,
      body: input.body,
      items: input.items,
      locale,
    });
    await writeRecommendationJob(actor, {
      classroom,
      locale,
      title: typed.title,
      body: typed.body,
      items: typed.items,
      focus: typed.focus,
      generatedByAi: false,
      sourceId: classroom.id,
      ip,
    });
    return getAiSystemsDesk(actor);
  }

  if (input.action === "update_recommendation") {
    if (!canEditAi(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can generate recommendations");
    }
    const [job] = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.id, input.jobId))
      .limit(1);
    if (!job?.classroomId || job.kind !== "recommendation") {
      throw new ApiError(404, "NOT_FOUND", "Recommendation draft not found");
    }
    const classroom = await requireVisibleClassroom(actor, job.classroomId);
    if (actor.roleKey === "teacher" && actor.userId !== classroom.teacherUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only edit recommendations for your own lessons");
    }
    const locale = asLocale(job.locale);
    const typed = parseTypedRecommendation({
      title: input.title,
      body: input.body,
      items: input.items,
      locale,
    });
    const items = input.items?.trim()
      ? typed.items
      : payloadRecommendationItems(job.payload);
    requireAiSafeFields([typed.title, typed.body, ...items], "reject");
    const now = new Date();
    const identified = applyAiIdentification(
      {
        ...(job.payload ?? {}),
        title: typed.title,
        body: typed.body,
        items,
      },
      false,
      job,
    );
    await db
      .update(aiJobs)
      .set({
        status: "needs_review",
        title: typed.title,
        generatedByAi: identified.generatedByAi,
        requiresReview: true,
        payload: identified.payload,
        ...unpublishedAcademicFields(),
        updatedAt: now,
      })
      .where(eq(aiJobs.id, job.id));
    await writeAuditLog({
      actor,
      action: "ai.recommendation.updated",
      entityType: "ai_job",
      entityId: job.id,
      ipAddress: ip,
      metadata: { classroomId: job.classroomId },
    });
    return getAiSystemsDesk(actor);
  }

  const classroom = await requireVisibleClassroom(actor, input.classroomId);
  const recordingId = input.recordingId ?? (await latestRecordingId(classroom.id));
  if (input.action === "save_speech") {
    await saveSpeechTranscript(actor, {
      classroom,
      recordingId,
      locale: input.locale,
      finalize: input.finalize,
      segments: input.segments,
      ip,
    });
    return getAiSystemsDesk(actor);
  }
  const locale = input.locale ?? "en";
  if (input.action === "save_text") {
    await appendToOpenTranscript(actor, {
      classroom,
      recordingId,
      locale,
      segments: prepareTranscriptSegments(segmentsFromTypedBody(input.body, locale), locale),
      generatedByAi: false,
      source: "typed",
      ip,
      audit: "ai.transcription.typed",
    });
    return getAiSystemsDesk(actor);
  }
  const segments = await segmentsFromClassroom(classroom.id);
  await appendToOpenTranscript(actor, {
    classroom,
    recordingId,
    locale,
    segments: prepareTranscriptSegments(segments, locale),
    generatedByAi: true,
    source: "chat",
    ip,
    audit: "ai.transcription.chat",
  });
  return getAiSystemsDesk(actor);
}
