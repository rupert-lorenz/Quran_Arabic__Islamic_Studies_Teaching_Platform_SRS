import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { examSittings, exams, parentChildren, subjects, users } from "@/db/schema";
import {
  emptyExamPayload,
  examPayloadIsReady,
  examRemainingSeconds,
  examWasAutoSubmitted,
  examWindowStatus,
  EXAM_MAX_DURATION,
  EXAM_MAX_QUESTIONS,
  EXAM_MIN_DURATION,
  examsHref,
  parseExamDate,
  parseExamPayload,
  type ExamStatus,
  type ExamWindowStatus,
} from "@/lib/exams";
import {
  createQuizSitOrder,
  mergeQuizMarks,
  orderQuizQuestions,
  parseQuizMarks,
  parseQuizSitOrder,
  quizPercentPassed,
  scoreQuizAttempt,
  toQuizSitView,
  type QuizAnswerInput,
  type QuizAnswerMark,
  type QuizMarkingStatus,
  type QuizPayload,
  type QuizReviewItem,
  type QuizSitQuestion,
} from "@/lib/quizzes";
import { loadReadyBankQuestions } from "@/server/lms/question-bank";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { requireHumanSensitiveDecision } from "@/server/ai/human-decision";
import { ApiError } from "@/server/api/errors";
import { safeMaybeIssueCertificates } from "@/server/lms/certificates";
import { safeAwardGamification } from "@/server/lms/gamification";
import { getTeacherVerificationStatus } from "@/server/teacher/onboarding";

export type ExamSittingRecord = {
  studentUserId: string;
  studentName: string;
  startedAt: string;
  dueAt: string;
  submittedAt: string | null;
  remainingSeconds: number;
  score: number | null;
  total: number | null;
  percent: number | null;
  passed: boolean | null;
  markingStatus: QuizMarkingStatus;
  pendingCount: number;
  autoSubmitted: boolean;
  review: QuizReviewItem[] | null;
};

export type ExamView = {
  id: string;
  title: string;
  instructions: string | null;
  subjectSlug: string | null;
  subjectName: string | null;
  status: ExamStatus;
  windowStatus: ExamWindowStatus;
  passPercent: number;
  durationMinutes: number;
  randomiseQuestions: boolean;
  opensAt: string | null;
  closesAt: string | null;
  teacherName: string;
  href: string;
  canManage: boolean;
  canStart: boolean;
  canSubmit: boolean;
  canRecord: boolean;
  revealReview: boolean;
  questionCount: number;
  payload: QuizPayload | null;
  sit: QuizSitQuestion[] | null;
  sitting: ExamSittingRecord | null;
  sittings: ExamSittingRecord[];
  learners: Array<{ studentUserId: string; name: string }>;
};

export type ExamDesk = {
  subjects: Array<{ slug: string; name: string }>;
  items: ExamView[];
};

function isStaffCurriculum(actor: ApiActor) {
  return hasAnyPermission(actor, "academic.curriculum");
}

async function canCreateExams(actor: ApiActor) {
  if (isStaffCurriculum(actor)) return true;
  if (actor.roleKey !== "teacher") return false;
  const status = await getTeacherVerificationStatus(actor.userId);
  return status === "approved";
}

function examsPath(actor: ApiActor, id?: string) {
  return examsHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffCurriculum(actor),
    id,
  );
}

async function learnersForActor(actor: ApiActor) {
  if (actor.roleKey === "student") {
    const [user] = await db
      .select({ name: users.displayName })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1);
    return [{ studentUserId: actor.userId, name: user?.name ?? "Student" }];
  }
  if (actor.roleKey !== "parent") return [];
  const children = await db
    .select({
      id: parentChildren.childUserId,
      name: users.displayName,
    })
    .from(parentChildren)
    .innerJoin(users, eq(users.id, parentChildren.childUserId))
    .where(eq(parentChildren.parentUserId, actor.userId));
  return children.map((child) => ({
    studentUserId: child.id,
    name: child.name ?? "Student",
  }));
}

function canManageRow(actor: ApiActor, row: { createdByUserId: string }) {
  return isStaffCurriculum(actor) || row.createdByUserId === actor.userId;
}

function canSeeRow(
  actor: ApiActor,
  row: { status: ExamStatus; createdByUserId: string },
) {
  if (canManageRow(actor, row)) return true;
  if (row.status !== "published") return false;
  return (
    actor.roleKey === "student" ||
    actor.roleKey === "parent" ||
    actor.roleKey === "teacher" ||
    isStaffRole(actor.roleKey)
  );
}

function clampPass(value: number | undefined, fallback: number) {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function clampDuration(value: number | undefined, fallback: number) {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(EXAM_MAX_DURATION, Math.max(EXAM_MIN_DURATION, Math.round(value)));
}

function requireWindow(opensAt: Date | null, closesAt: Date | null) {
  if (!opensAt || !closesAt) {
    throw new ApiError(422, "VALIDATION", "Set the exam open and close times");
  }
  if (closesAt <= opensAt) {
    throw new ApiError(422, "VALIDATION", "The close time must be after the open time");
  }
}

async function loadExamRow(id: string) {
  const [row] = await db
    .select({
      id: exams.id,
      title: exams.title,
      instructions: exams.instructions,
      subjectSlug: exams.subjectSlug,
      subjectName: subjects.name,
      status: exams.status,
      passPercent: exams.passPercent,
      durationMinutes: exams.durationMinutes,
      randomiseQuestions: exams.randomiseQuestions,
      opensAt: exams.opensAt,
      closesAt: exams.closesAt,
      payload: exams.payload,
      createdByUserId: exams.createdByUserId,
      teacherName: users.displayName,
    })
    .from(exams)
    .leftJoin(subjects, eq(subjects.slug, exams.subjectSlug))
    .innerJoin(users, eq(users.id, exams.createdByUserId))
    .where(eq(exams.id, id))
    .limit(1);
  return row ?? null;
}

async function finalizeOverdueSitting(
  sitting: typeof examSittings.$inferSelect,
  payload: QuizPayload,
  passPercent: number,
) {
  if (sitting.submittedAt) return sitting;
  if (new Date() <= sitting.dueAt) return sitting;
  const marks = parseQuizMarks(sitting.marks);
  const result = scoreQuizAttempt(payload, sitting.answers ?? [], marks);
  const passed =
    result.markingStatus === "pending"
      ? false
      : quizPercentPassed(result.percent, passPercent);
  const [updated] = await db
    .update(examSittings)
    .set({
      submittedAt: sitting.dueAt,
      score: result.score,
      total: result.total,
      percent: result.percent,
      passed,
      markingStatus: result.markingStatus,
      marks,
    })
    .where(eq(examSittings.id, sitting.id))
    .returning();
  return updated ?? sitting;
}

async function toExamView(
  actor: ApiActor,
  row: NonNullable<Awaited<ReturnType<typeof loadExamRow>>>,
  options?: { studentUserId?: string },
): Promise<ExamView> {
  const canManage = canManageRow(actor, row);
  const learners = await learnersForActor(actor);
  const canRecord = learners.length > 0;
  const selectedLearner =
    options?.studentUserId &&
    learners.some((learner) => learner.studentUserId === options.studentUserId)
      ? options.studentUserId
      : learners[0]?.studentUserId;
  const payload = parseExamPayload(row.payload);
  const ready = examPayloadIsReady(payload);
  const window = examWindowStatus(row);
  const revealReview = canManage || window === "closed";

  const sittingFilter = [eq(examSittings.examId, row.id)];
  if (!canManage) {
    sittingFilter.push(
      eq(examSittings.studentUserId, selectedLearner ?? actor.userId),
    );
  }
  const sittingRows = await db
    .select({
      sitting: examSittings,
      studentName: users.displayName,
    })
    .from(examSittings)
    .innerJoin(users, eq(users.id, examSittings.studentUserId))
    .where(and(...sittingFilter))
    .orderBy(desc(examSittings.startedAt));

  const sittings: ExamSittingRecord[] = [];
  for (const joined of sittingRows) {
    const sitting = await finalizeOverdueSitting(
      joined.sitting,
      payload,
      row.passPercent,
    );
    const sitOrder = parseQuizSitOrder(sitting.questionOrder, payload);
    const scored = sitting.submittedAt
      ? scoreQuizAttempt(
          payload,
          sitting.answers ?? [],
          parseQuizMarks(sitting.marks),
        )
      : null;
    const review = scored?.review
      ? orderQuizQuestions(scored.review, sitOrder)
      : null;
    sittings.push({
      studentUserId: sitting.studentUserId,
      studentName: joined.studentName ?? "Student",
      startedAt: sitting.startedAt.toISOString(),
      dueAt: sitting.dueAt.toISOString(),
      submittedAt: sitting.submittedAt?.toISOString() ?? null,
      remainingSeconds: examRemainingSeconds(sitting.dueAt),
      score: scored?.score ?? sitting.score,
      total: scored?.total ?? sitting.total,
      percent: scored?.percent ?? sitting.percent,
      passed:
        scored?.markingStatus === "pending"
          ? false
          : (scored ? quizPercentPassed(scored.percent, row.passPercent) : sitting.passed),
      markingStatus: scored?.markingStatus ?? sitting.markingStatus,
      pendingCount: scored?.pendingCount ?? 0,
      autoSubmitted: examWasAutoSubmitted(sitting.submittedAt, sitting.dueAt),
      review:
        review && (canManage || revealReview || scored?.markingStatus !== "auto")
          ? review.map((item) =>
              canManage || revealReview || item.marking === "manual"
                ? item
                : { ...item, expected: "" },
            )
          : null,
    });
  }

  const sitting =
    sittings.find((item) => item.studentUserId === selectedLearner) ??
    sittings[0] ??
    null;
  const inProgress = Boolean(sitting && !sitting.submittedAt);
  const canStart =
    ready &&
    (canManage ||
      (row.status === "published" &&
        window === "open" &&
        canRecord &&
        !sitting));
  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    subjectSlug: row.subjectSlug,
    subjectName: row.subjectName,
    status: row.status,
    windowStatus: window,
    passPercent: row.passPercent,
    durationMinutes: row.durationMinutes,
    randomiseQuestions: row.randomiseQuestions,
    opensAt: row.opensAt?.toISOString() ?? null,
    closesAt: row.closesAt?.toISOString() ?? null,
    teacherName: row.teacherName ?? "Teacher",
    href: examsPath(actor, row.id),
    canManage,
    canStart,
    canSubmit: canManage || inProgress,
    canRecord,
    revealReview,
    questionCount: payload.questions.length,
    payload: canManage ? payload : null,
    sit:
      canManage || inProgress
        ? toQuizSitView(
            payload,
            inProgress
              ? parseQuizSitOrder(
                  sittingRows.find(
                    (joined) =>
                      joined.sitting.studentUserId === sitting?.studentUserId,
                  )?.sitting.questionOrder,
                  payload,
                )
              : null,
          )
        : null,
    sitting,
    sittings: canManage ? sittings.slice(0, 40) : sitting ? [sitting] : [],
    learners,
  };
}

export async function listExams(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<ExamView[]> {
  const teacherOnlyOwnDrafts =
    actor.roleKey === "teacher" && !isStaffCurriculum(actor);
  const learnerOnly = actor.roleKey === "student" || actor.roleKey === "parent";
  const rows = await db
    .select({
      id: exams.id,
      title: exams.title,
      instructions: exams.instructions,
      subjectSlug: exams.subjectSlug,
      subjectName: subjects.name,
      status: exams.status,
      passPercent: exams.passPercent,
      durationMinutes: exams.durationMinutes,
      randomiseQuestions: exams.randomiseQuestions,
      opensAt: exams.opensAt,
      closesAt: exams.closesAt,
      payload: exams.payload,
      createdByUserId: exams.createdByUserId,
      teacherName: users.displayName,
    })
    .from(exams)
    .leftJoin(subjects, eq(subjects.slug, exams.subjectSlug))
    .innerJoin(users, eq(users.id, exams.createdByUserId))
    .where(
      learnerOnly
        ? eq(exams.status, "published")
        : teacherOnlyOwnDrafts
          ? or(eq(exams.createdByUserId, actor.userId), eq(exams.status, "published"))
          : undefined,
    )
    .orderBy(desc(exams.updatedAt));

  return Promise.all(
    rows
      .filter((row) => canSeeRow(actor, row))
      .map((row) => toExamView(actor, row, options)),
  );
}

export async function listExamsDesk(actor: ApiActor): Promise<ExamDesk> {
  if (!(await canCreateExams(actor))) {
    return { subjects: [], items: await listExams(actor) };
  }
  const [subjectRows, items] = await Promise.all([
    db
      .select({ slug: subjects.slug, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.isEnabled, true))
      .orderBy(subjects.sortOrder),
    listExams(actor),
  ]);
  return { subjects: subjectRows, items };
}

export async function getExam(
  actor: ApiActor,
  id: string,
  options?: { studentUserId?: string },
): Promise<ExamView> {
  const row = await loadExamRow(id);
  if (!row || !canSeeRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Exam not found");
  }
  return toExamView(actor, row, options);
}

export async function createExam(
  actor: ApiActor,
  input: {
    title: string;
    instructions?: string;
    subjectSlug?: string;
    passPercent?: number;
    durationMinutes?: number;
    randomiseQuestions?: boolean;
    opensAt?: string;
    closesAt?: string;
  },
  ip: string,
) {
  if (!(await canCreateExams(actor))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot create exams");
  }
  const title = input.title.trim();
  if (title.length < 2) {
    throw new ApiError(422, "VALIDATION", "Enter a title for this exam");
  }
  const subjectSlug = input.subjectSlug?.trim() || null;
  if (subjectSlug) {
    const [subject] = await db
      .select({ slug: subjects.slug })
      .from(subjects)
      .where(eq(subjects.slug, subjectSlug))
      .limit(1);
    if (!subject) {
      throw new ApiError(422, "VALIDATION", "Choose a published subject");
    }
  }
  const opensAt = parseExamDate(input.opensAt);
  const closesAt = parseExamDate(input.closesAt);
  if (opensAt || closesAt) requireWindow(opensAt, closesAt);
  const [created] = await db
    .insert(exams)
    .values({
      title,
      instructions: input.instructions?.trim() || null,
      subjectSlug,
      passPercent: clampPass(input.passPercent, 50),
      durationMinutes: clampDuration(input.durationMinutes, 45),
      randomiseQuestions: Boolean(input.randomiseQuestions),
      opensAt,
      closesAt,
      payload: emptyExamPayload(),
      createdByUserId: actor.userId,
    })
    .returning({ id: exams.id });
  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not create the exam");
  }
  await writeAuditLog({
    actor,
    action: "lms.exam.create",
    entityType: "exam",
    entityId: created.id,
    ipAddress: ip,
  });
  return listExamsDesk(actor);
}

export async function saveExam(
  actor: ApiActor,
  input: {
    examId: string;
    title?: string;
    instructions?: string;
    subjectSlug?: string;
    passPercent?: number;
    durationMinutes?: number;
    randomiseQuestions?: boolean;
    opensAt?: string;
    closesAt?: string;
    payload?: unknown;
  },
  ip: string,
) {
  const row = await loadExamRow(input.examId);
  if (!row || !canManageRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Exam not found");
  }
  const title = input.title?.trim();
  const subjectSlug =
    input.subjectSlug === undefined
      ? undefined
      : input.subjectSlug.trim() || null;
  if (subjectSlug) {
    const [subject] = await db
      .select({ slug: subjects.slug })
      .from(subjects)
      .where(eq(subjects.slug, subjectSlug))
      .limit(1);
    if (!subject) {
      throw new ApiError(422, "VALIDATION", "Choose a published subject");
    }
  }
  const opensAt =
    input.opensAt === undefined ? undefined : parseExamDate(input.opensAt);
  const closesAt =
    input.closesAt === undefined ? undefined : parseExamDate(input.closesAt);
  const nextOpens = opensAt === undefined ? row.opensAt : opensAt;
  const nextCloses = closesAt === undefined ? row.closesAt : closesAt;
  if (nextOpens || nextCloses) requireWindow(nextOpens, nextCloses);
  const payload =
    input.payload === undefined ? undefined : parseExamPayload(input.payload);
  await db
    .update(exams)
    .set({
      ...(title && title.length >= 2 ? { title } : {}),
      ...(input.instructions !== undefined
        ? { instructions: input.instructions.trim() || null }
        : {}),
      ...(subjectSlug !== undefined ? { subjectSlug } : {}),
      ...(input.passPercent !== undefined
        ? { passPercent: clampPass(input.passPercent, row.passPercent) }
        : {}),
      ...(input.durationMinutes !== undefined
        ? { durationMinutes: clampDuration(input.durationMinutes, row.durationMinutes) }
        : {}),
      ...(input.randomiseQuestions !== undefined
        ? { randomiseQuestions: Boolean(input.randomiseQuestions) }
        : {}),
      ...(opensAt !== undefined ? { opensAt } : {}),
      ...(closesAt !== undefined ? { closesAt } : {}),
      ...(payload ? { payload } : {}),
    })
    .where(eq(exams.id, row.id));
  await writeAuditLog({
    actor,
    action: "lms.exam.save",
    entityType: "exam",
    entityId: row.id,
    ipAddress: ip,
  });
  return getExam(actor, row.id);
}

export async function setExamStatus(
  actor: ApiActor,
  input: { examId: string; status: ExamStatus },
  ip: string,
) {
  const row = await loadExamRow(input.examId);
  if (!row || !canManageRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Exam not found");
  }
  if (input.status === "published") {
    const payload = parseExamPayload(row.payload);
    if (!examPayloadIsReady(payload)) {
      throw new ApiError(422, "VALIDATION", "Finish the questions before publishing");
    }
    requireWindow(row.opensAt, row.closesAt);
  }
  await db
    .update(exams)
    .set({ status: input.status })
    .where(eq(exams.id, row.id));
  await writeAuditLog({
    actor,
    action: "lms.exam.status",
    entityType: "exam",
    entityId: row.id,
    metadata: { status: input.status },
    ipAddress: ip,
  });
  return getExam(actor, row.id);
}

export async function importExamFromBank(
  actor: ApiActor,
  input: { examId: string; questionIds: string[] },
  ip: string,
) {
  const row = await loadExamRow(input.examId);
  if (!row || !canManageRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Exam not found");
  }
  const current = parseExamPayload(row.payload);
  const already = new Set(
    current.questions
      .map((question) => question.bankId)
      .filter((id): id is string => Boolean(id)),
  );
  const incoming = (await loadReadyBankQuestions(actor, input.questionIds)).filter(
    (question) => !question.bankId || !already.has(question.bankId),
  );
  const room = EXAM_MAX_QUESTIONS - current.questions.length;
  if (room < 1) {
    throw new ApiError(422, "VALIDATION", "This exam already has the maximum number of questions");
  }
  const nextQuestions = [...current.questions, ...incoming.slice(0, room)];
  if (nextQuestions.length === current.questions.length) {
    throw new ApiError(422, "VALIDATION", "Those questions are already on this exam");
  }
  await db
    .update(exams)
    .set({ payload: { questions: nextQuestions } })
    .where(eq(exams.id, row.id));
  await writeAuditLog({
    actor,
    action: "lms.exam.import_bank",
    entityType: "exam",
    entityId: row.id,
    metadata: { count: nextQuestions.length - current.questions.length },
    ipAddress: ip,
  });
  return getExam(actor, row.id);
}

export async function startExam(
  actor: ApiActor,
  input: { examId: string; studentUserId?: string },
  ip: string,
) {
  const row = await loadExamRow(input.examId);
  if (!row || !canSeeRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Exam not found");
  }
  const canManage = canManageRow(actor, row);
  const payload = parseExamPayload(row.payload);
  if (!examPayloadIsReady(payload)) {
    throw new ApiError(422, "VALIDATION", "This exam is not ready");
  }
  if (!canManage) {
    if (row.status !== "published" || examWindowStatus(row) !== "open") {
      throw new ApiError(403, "FORBIDDEN", "This exam is not open");
    }
  }
  const learners = await learnersForActor(actor);
  const studentUserId =
    input.studentUserId &&
    learners.some((learner) => learner.studentUserId === input.studentUserId)
      ? input.studentUserId
      : learners[0]?.studentUserId;
  if (!studentUserId) {
    return getExam(actor, row.id);
  }
  const [existing] = await db
    .select()
    .from(examSittings)
    .where(
      and(
        eq(examSittings.examId, row.id),
        eq(examSittings.studentUserId, studentUserId),
      ),
    )
    .limit(1);
  if (existing) {
    await finalizeOverdueSitting(existing, payload, row.passPercent);
    return getExam(actor, row.id, { studentUserId });
  }
  const startedAt = new Date();
  const dueAt = new Date(startedAt.getTime() + row.durationMinutes * 60_000);
  await db.insert(examSittings).values({
    examId: row.id,
    studentUserId,
    startedAt,
    dueAt,
    answers: [],
    questionOrder: row.randomiseQuestions
      ? createQuizSitOrder(payload)
      : { questionIds: [], choices: {} },
  });
  await writeAuditLog({
    actor,
    action: "lms.exam.start",
    entityType: "exam",
    entityId: row.id,
    metadata: { studentUserId },
    ipAddress: ip,
  });
  return getExam(actor, row.id, { studentUserId });
}

export async function submitExam(
  actor: ApiActor,
  input: {
    examId: string;
    answers: QuizAnswerInput[];
    studentUserId?: string;
  },
  ip: string,
) {
  const row = await loadExamRow(input.examId);
  if (!row || !canSeeRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Exam not found");
  }
  const canManage = canManageRow(actor, row);
  const payload = parseExamPayload(row.payload);
  const result = scoreQuizAttempt(payload, input.answers);
  const passed =
    result.markingStatus === "pending"
      ? false
      : quizPercentPassed(result.percent, row.passPercent);
  const learners = await learnersForActor(actor);
  const studentUserId =
    input.studentUserId &&
    learners.some((learner) => learner.studentUserId === input.studentUserId)
      ? input.studentUserId
      : learners[0]?.studentUserId;
  if (studentUserId) {
    const [sitting] = await db
      .select()
      .from(examSittings)
      .where(
        and(
          eq(examSittings.examId, row.id),
          eq(examSittings.studentUserId, studentUserId),
        ),
      )
      .limit(1);
    if (!sitting) {
      throw new ApiError(422, "VALIDATION", "Start the exam before submitting");
    }
    if (sitting.submittedAt) {
      throw new ApiError(422, "VALIDATION", "This exam sitting is already submitted");
    }
    await db
      .update(examSittings)
      .set({
        answers: input.answers,
        submittedAt: new Date(),
        score: result.score,
        total: result.total,
        percent: result.percent,
        passed,
        markingStatus: result.markingStatus,
        marks: [],
      })
      .where(eq(examSittings.id, sitting.id));
    await writeAuditLog({
      actor,
      action: "lms.exam.submit",
      entityType: "exam",
      entityId: row.id,
      metadata: { studentUserId, ...result, passed },
      ipAddress: ip,
    });
    if (passed) {
      await safeMaybeIssueCertificates(actor, {
        kind: "exam",
        studentUserId,
        sourceId: row.id,
        sourceTitle: row.title,
        subjectSlug: row.subjectSlug,
        percent: result.percent,
      });
      await safeAwardGamification({
        kind: "exam",
        studentUserId,
        sourceId: row.id,
        title: row.title,
      });
    }
  }
  const view = await getExam(actor, row.id, { studentUserId });
  const revealReview = canManage || examWindowStatus(row) === "closed";
  return {
    ...view,
    result: {
      score: result.score,
      total: result.total,
      percent: result.percent,
      passed,
      markingStatus: result.markingStatus,
      pendingCount: result.pendingCount,
      review: revealReview
        ? result.review
        : result.markingStatus === "auto"
          ? null
          : result.review.map((item) =>
              item.marking === "manual" ? item : { ...item, expected: "" },
            ),
    },
  };
}

export async function markExamSitting(
  actor: ApiActor,
  input: {
    examId: string;
    studentUserId: string;
    marks: QuizAnswerMark[];
  },
  ip: string,
) {
  requireHumanSensitiveDecision();
  const row = await loadExamRow(input.examId);
  if (!row || !canManageRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Exam not found");
  }
  const [sitting] = await db
    .select()
    .from(examSittings)
    .where(
      and(
        eq(examSittings.examId, row.id),
        eq(examSittings.studentUserId, input.studentUserId),
      ),
    )
    .limit(1);
  if (!sitting?.submittedAt) {
    throw new ApiError(422, "VALIDATION", "Mark a submitted sitting");
  }
  const payload = parseExamPayload(row.payload);
  const writtenIds = new Set(
    payload.questions
      .filter((question) => question.kind === "written")
      .map((question) => question.id),
  );
  if (!writtenIds.size) {
    throw new ApiError(422, "VALIDATION", "This exam has no written answers to mark");
  }
  const marks = mergeQuizMarks(
    parseQuizMarks(sitting.marks),
    input.marks,
    writtenIds,
  );
  const result = scoreQuizAttempt(payload, sitting.answers ?? [], marks);
  const passed =
    result.markingStatus === "pending"
      ? false
      : quizPercentPassed(result.percent, row.passPercent);
  await db
    .update(examSittings)
    .set({
      marks,
      markingStatus: result.markingStatus,
      score: result.score,
      total: result.total,
      percent: result.percent,
      passed,
    })
    .where(eq(examSittings.id, sitting.id));
  await writeAuditLog({
    actor,
    action: "lms.exam.mark",
    entityType: "exam",
    entityId: row.id,
    metadata: { studentUserId: sitting.studentUserId, ...result, passed },
    ipAddress: ip,
  });
  if (passed) {
    await safeMaybeIssueCertificates(actor, {
      kind: "exam",
      studentUserId: sitting.studentUserId,
      sourceId: row.id,
      sourceTitle: row.title,
      subjectSlug: row.subjectSlug,
      percent: result.percent,
    });
    await safeAwardGamification({
      kind: "exam",
      studentUserId: sitting.studentUserId,
      sourceId: row.id,
      title: row.title,
    });
  }
  return getExam(actor, row.id, { studentUserId: sitting.studentUserId });
}
