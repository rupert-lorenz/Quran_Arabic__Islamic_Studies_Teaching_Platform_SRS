import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  parentChildren,
  quizAttempts,
  quizzes,
  subjects,
  users,
} from "@/db/schema";
import {
  emptyQuizPayload,
  mergeQuizMarks,
  createQuizSitOrder,
  parseQuizMarks,
  parseQuizPayload,
  QUIZ_MAX_QUESTIONS,
  quizPayloadIsReady,
  quizPercentPassed,
  quizQuestionIsReady,
  quizzesHref,
  scoreQuizAttempt,
  toQuizSitView,
  type QuizAnswerInput,
  type QuizAnswerMark,
  type QuizMarkingStatus,
  type QuizPayload,
  type QuizReviewItem,
  type QuizSitQuestion,
  type QuizStatus,
} from "@/lib/quizzes";
import {
  createQuestionBankItem,
  loadReadyBankQuestions,
} from "@/server/lms/question-bank";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { requireHumanSensitiveDecision } from "@/server/ai/human-decision";
import { ApiError } from "@/server/api/errors";
import { safeMaybeIssueCertificates } from "@/server/lms/certificates";
import { safeAwardGamification } from "@/server/lms/gamification";
import { getTeacherVerificationStatus } from "@/server/teacher/onboarding";

export type QuizAttemptRecord = {
  id: string;
  studentUserId: string;
  studentName: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  markingStatus: QuizMarkingStatus;
  pendingCount: number;
  submittedAt: string;
  review: QuizReviewItem[] | null;
};

export type QuizView = {
  id: string;
  title: string;
  instructions: string | null;
  subjectSlug: string | null;
  subjectName: string | null;
  status: QuizStatus;
  passPercent: number;
  attemptLimit: number;
  randomiseQuestions: boolean;
  attemptCount: number;
  remainingAttempts: number | null;
  teacherName: string;
  href: string;
  canManage: boolean;
  canSit: boolean;
  canRecord: boolean;
  questionCount: number;
  payload: QuizPayload | null;
  sit: QuizSitQuestion[] | null;
  lastAttempt: QuizAttemptRecord | null;
  attempts: QuizAttemptRecord[];
  learners: Array<{ studentUserId: string; name: string }>;
};

export type QuizDesk = {
  subjects: Array<{ slug: string; name: string }>;
  items: QuizView[];
};

function isStaffCurriculum(actor: ApiActor) {
  return hasAnyPermission(actor, "academic.curriculum");
}

async function canCreateQuizzes(actor: ApiActor) {
  if (isStaffCurriculum(actor)) return true;
  if (actor.roleKey !== "teacher") return false;
  const status = await getTeacherVerificationStatus(actor.userId);
  return status === "approved";
}

function quizzesPath(actor: ApiActor, id?: string) {
  return quizzesHref(
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
  row: { status: QuizStatus; createdByUserId: string },
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

function clampAttempts(value: number | undefined, fallback: number) {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(10, Math.max(0, Math.round(value)));
}

async function loadQuizRow(id: string) {
  const [row] = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      instructions: quizzes.instructions,
      subjectSlug: quizzes.subjectSlug,
      subjectName: subjects.name,
      status: quizzes.status,
      passPercent: quizzes.passPercent,
      attemptLimit: quizzes.attemptLimit,
      randomiseQuestions: quizzes.randomiseQuestions,
      payload: quizzes.payload,
      createdByUserId: quizzes.createdByUserId,
      teacherName: users.displayName,
    })
    .from(quizzes)
    .leftJoin(subjects, eq(subjects.slug, quizzes.subjectSlug))
    .innerJoin(users, eq(users.id, quizzes.createdByUserId))
    .where(eq(quizzes.id, id))
    .limit(1);
  return row ?? null;
}

async function toQuizView(
  actor: ApiActor,
  row: NonNullable<Awaited<ReturnType<typeof loadQuizRow>>>,
  options?: { studentUserId?: string },
): Promise<QuizView> {
  const canManage = canManageRow(actor, row);
  const learners = await learnersForActor(actor);
  const canRecord = learners.length > 0;
  const selectedLearner =
    options?.studentUserId &&
    learners.some((learner) => learner.studentUserId === options.studentUserId)
      ? options.studentUserId
      : learners[0]?.studentUserId;
  const payload = parseQuizPayload(row.payload);
  const ready = quizPayloadIsReady(payload);
  const attemptFilter = [eq(quizAttempts.quizId, row.id)];
  if (!canManage) {
    attemptFilter.push(
      eq(quizAttempts.studentUserId, selectedLearner ?? actor.userId),
    );
  }
  const attemptRows = await db
    .select({
      id: quizAttempts.id,
      studentUserId: quizAttempts.studentUserId,
      studentName: users.displayName,
      score: quizAttempts.score,
      total: quizAttempts.total,
      percent: quizAttempts.percent,
      passed: quizAttempts.passed,
      markingStatus: quizAttempts.markingStatus,
      answers: quizAttempts.answers,
      marks: quizAttempts.marks,
      submittedAt: quizAttempts.submittedAt,
    })
    .from(quizAttempts)
    .innerJoin(users, eq(users.id, quizAttempts.studentUserId))
    .where(and(...attemptFilter))
    .orderBy(desc(quizAttempts.submittedAt));

  const attempts: QuizAttemptRecord[] = attemptRows.map((attempt) => {
    const scored = scoreQuizAttempt(
      payload,
      attempt.answers,
      parseQuizMarks(attempt.marks),
    );
    return {
      id: attempt.id,
      studentUserId: attempt.studentUserId,
      studentName: attempt.studentName ?? "Student",
      score: scored.score,
      total: scored.total,
      percent: scored.percent,
      passed: scored.markingStatus === "pending" ? false : scored.percent >= row.passPercent,
      markingStatus: scored.markingStatus,
      pendingCount: scored.pendingCount,
      submittedAt: attempt.submittedAt.toISOString(),
      review: scored.review,
    };
  });
  const learnerAttempts = selectedLearner
    ? attempts.filter((attempt) => attempt.studentUserId === selectedLearner)
    : attempts;
  const lastAttempt = learnerAttempts[0] ?? null;
  if (lastAttempt && !canManage) {
    lastAttempt.review = scoreQuizAttempt(
      payload,
      attemptRows.find((row) => row.id === lastAttempt.id)?.answers ?? [],
      parseQuizMarks(attemptRows.find((row) => row.id === lastAttempt.id)?.marks),
    ).review;
  }
  const attemptCount = learnerAttempts.length;
  const remainingAttempts =
    row.attemptLimit < 1 ? null : Math.max(0, row.attemptLimit - attemptCount);
  const canSit =
    ready &&
    (row.status === "published" || canManage) &&
    (canManage || remainingAttempts === null || remainingAttempts > 0);

  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    subjectSlug: row.subjectSlug,
    subjectName: row.subjectName,
    status: row.status,
    passPercent: row.passPercent,
    attemptLimit: row.attemptLimit,
    randomiseQuestions: row.randomiseQuestions,
    attemptCount,
    remainingAttempts,
    teacherName: row.teacherName ?? "Teacher",
    href: quizzesPath(actor, row.id),
    canManage,
    canSit,
    canRecord,
    questionCount: payload.questions.length,
    payload: canManage ? payload : null,
    sit: canSit
      ? toQuizSitView(
          payload,
          row.randomiseQuestions ? createQuizSitOrder(payload) : null,
        )
      : null,
    lastAttempt,
    attempts: canManage ? attempts.slice(0, 30) : lastAttempt ? [lastAttempt] : [],
    learners,
  };
}

export async function listQuizzes(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<QuizView[]> {
  const teacherOnlyOwnDrafts =
    actor.roleKey === "teacher" && !isStaffCurriculum(actor);
  const learnerOnly = actor.roleKey === "student" || actor.roleKey === "parent";
  const rows = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      instructions: quizzes.instructions,
      subjectSlug: quizzes.subjectSlug,
      subjectName: subjects.name,
      status: quizzes.status,
      passPercent: quizzes.passPercent,
      attemptLimit: quizzes.attemptLimit,
      randomiseQuestions: quizzes.randomiseQuestions,
      payload: quizzes.payload,
      createdByUserId: quizzes.createdByUserId,
      teacherName: users.displayName,
    })
    .from(quizzes)
    .leftJoin(subjects, eq(subjects.slug, quizzes.subjectSlug))
    .innerJoin(users, eq(users.id, quizzes.createdByUserId))
    .where(
      learnerOnly
        ? eq(quizzes.status, "published")
        : teacherOnlyOwnDrafts
          ? or(
              eq(quizzes.createdByUserId, actor.userId),
              eq(quizzes.status, "published"),
            )
          : undefined,
    )
    .orderBy(desc(quizzes.updatedAt));

  return Promise.all(
    rows
      .filter((row) => canSeeRow(actor, row))
      .map((row) => toQuizView(actor, row, options)),
  );
}

export async function listQuizzesDesk(actor: ApiActor): Promise<QuizDesk> {
  if (!(await canCreateQuizzes(actor))) {
    return { subjects: [], items: await listQuizzes(actor) };
  }
  const [subjectRows, items] = await Promise.all([
    db
      .select({ slug: subjects.slug, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.isEnabled, true))
      .orderBy(subjects.sortOrder),
    listQuizzes(actor),
  ]);
  return { subjects: subjectRows, items };
}

export async function getQuiz(
  actor: ApiActor,
  id: string,
  options?: { studentUserId?: string },
): Promise<QuizView> {
  const row = await loadQuizRow(id);
  if (!row || !canSeeRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Quiz not found");
  }
  return toQuizView(actor, row, options);
}

export async function createQuiz(
  actor: ApiActor,
  input: {
    title: string;
    instructions?: string;
    subjectSlug?: string;
    passPercent?: number;
    attemptLimit?: number;
    randomiseQuestions?: boolean;
  },
  ip: string,
) {
  if (!(await canCreateQuizzes(actor))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot create quizzes");
  }
  const title = input.title.trim();
  if (title.length < 2) {
    throw new ApiError(422, "VALIDATION", "Enter a title for this quiz");
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
  const [created] = await db
    .insert(quizzes)
    .values({
      title,
      instructions: input.instructions?.trim() || null,
      subjectSlug,
      passPercent: clampPass(input.passPercent, 70),
      attemptLimit: clampAttempts(input.attemptLimit, 3),
      randomiseQuestions: Boolean(input.randomiseQuestions),
      payload: emptyQuizPayload(),
      createdByUserId: actor.userId,
    })
    .returning({ id: quizzes.id });
  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not create the quiz");
  }
  await writeAuditLog({
    actor,
    action: "lms.quiz.create",
    entityType: "quiz",
    entityId: created.id,
    ipAddress: ip,
  });
  return listQuizzesDesk(actor);
}

export async function saveQuiz(
  actor: ApiActor,
  input: {
    quizId: string;
    title?: string;
    instructions?: string;
    subjectSlug?: string;
    passPercent?: number;
    attemptLimit?: number;
    randomiseQuestions?: boolean;
    payload?: unknown;
  },
  ip: string,
) {
  const row = await loadQuizRow(input.quizId);
  if (!row || !canManageRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Quiz not found");
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
  const payload =
    input.payload === undefined ? undefined : parseQuizPayload(input.payload);
  await db
    .update(quizzes)
    .set({
      ...(title && title.length >= 2 ? { title } : {}),
      ...(input.instructions !== undefined
        ? { instructions: input.instructions.trim() || null }
        : {}),
      ...(subjectSlug !== undefined ? { subjectSlug } : {}),
      ...(input.passPercent !== undefined
        ? { passPercent: clampPass(input.passPercent, row.passPercent) }
        : {}),
      ...(input.attemptLimit !== undefined
        ? { attemptLimit: clampAttempts(input.attemptLimit, row.attemptLimit) }
        : {}),
      ...(input.randomiseQuestions !== undefined
        ? { randomiseQuestions: Boolean(input.randomiseQuestions) }
        : {}),
      ...(payload ? { payload } : {}),
    })
    .where(eq(quizzes.id, row.id));
  await writeAuditLog({
    actor,
    action: "lms.quiz.save",
    entityType: "quiz",
    entityId: row.id,
    ipAddress: ip,
  });
  return getQuiz(actor, row.id);
}

export async function importQuizFromBank(
  actor: ApiActor,
  input: { quizId: string; questionIds: string[] },
  ip: string,
) {
  const row = await loadQuizRow(input.quizId);
  if (!row || !canManageRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Quiz not found");
  }
  const current = parseQuizPayload(row.payload);
  const already = new Set(
    current.questions
      .map((question) => question.bankId)
      .filter((id): id is string => Boolean(id)),
  );
  const incoming = (await loadReadyBankQuestions(actor, input.questionIds)).filter(
    (question) => !question.bankId || !already.has(question.bankId),
  );
  const room = QUIZ_MAX_QUESTIONS - current.questions.length;
  if (room < 1) {
    throw new ApiError(
      422,
      "VALIDATION",
      "This quiz already has the maximum number of questions",
    );
  }
  const nextQuestions = [...current.questions, ...incoming.slice(0, room)];
  if (nextQuestions.length === current.questions.length) {
    throw new ApiError(422, "VALIDATION", "Those questions are already on this quiz");
  }
  await db
    .update(quizzes)
    .set({ payload: { questions: nextQuestions } })
    .where(eq(quizzes.id, row.id));
  await writeAuditLog({
    actor,
    action: "lms.quiz.import_bank",
    entityType: "quiz",
    entityId: row.id,
    metadata: { count: nextQuestions.length - current.questions.length },
    ipAddress: ip,
  });
  return getQuiz(actor, row.id);
}

export async function saveQuizQuestionToBank(
  actor: ApiActor,
  input: { quizId: string; questionId: string; topic?: string },
  ip: string,
) {
  const row = await loadQuizRow(input.quizId);
  if (!row || !canManageRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Quiz not found");
  }
  const payload = parseQuizPayload(row.payload);
  const question = payload.questions.find((item) => item.id === input.questionId);
  if (!question || !quizQuestionIsReady(question)) {
    throw new ApiError(422, "VALIDATION", "Finish this question before saving it to the bank");
  }
  await createQuestionBankItem(
    actor,
    {
      prompt: question.prompt,
      kind: question.kind,
      topic: input.topic,
      subjectSlug: row.subjectSlug ?? undefined,
      question,
    },
    ip,
  );
  return getQuiz(actor, row.id);
}

export async function setQuizStatus(
  actor: ApiActor,
  input: { quizId: string; status: QuizStatus },
  ip: string,
) {
  const row = await loadQuizRow(input.quizId);
  if (!row || !canManageRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Quiz not found");
  }
  if (input.status === "published") {
    const payload = parseQuizPayload(row.payload);
    if (!quizPayloadIsReady(payload)) {
      throw new ApiError(
        422,
        "VALIDATION",
        "Finish the questions before publishing",
      );
    }
  }
  await db
    .update(quizzes)
    .set({ status: input.status })
    .where(eq(quizzes.id, row.id));
  await writeAuditLog({
    actor,
    action: "lms.quiz.status",
    entityType: "quiz",
    entityId: row.id,
    metadata: { status: input.status },
    ipAddress: ip,
  });
  return getQuiz(actor, row.id);
}

export async function sitQuiz(
  actor: ApiActor,
  input: {
    quizId: string;
    answers: QuizAnswerInput[];
    studentUserId?: string;
  },
  ip: string,
) {
  const row = await loadQuizRow(input.quizId);
  if (!row || !canSeeRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Quiz not found");
  }
  const canManage = canManageRow(actor, row);
  if (row.status !== "published" && !canManage) {
    throw new ApiError(403, "FORBIDDEN", "This quiz is not open");
  }
  const payload = parseQuizPayload(row.payload);
  if (!quizPayloadIsReady(payload)) {
    throw new ApiError(422, "VALIDATION", "This quiz is not ready");
  }
  const learners = await learnersForActor(actor);
  const studentUserId =
    input.studentUserId &&
    learners.some((learner) => learner.studentUserId === input.studentUserId)
      ? input.studentUserId
      : learners[0]?.studentUserId;
  if (studentUserId && row.attemptLimit > 0) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.quizId, row.id),
          eq(quizAttempts.studentUserId, studentUserId),
        ),
      );
    if ((countRow?.count ?? 0) >= row.attemptLimit) {
      throw new ApiError(
        422,
        "VALIDATION",
        "No attempts remain for this quiz",
      );
    }
  }
  const result = scoreQuizAttempt(payload, input.answers);
  const passed =
    result.markingStatus === "pending"
      ? false
      : quizPercentPassed(result.percent, row.passPercent);
  if (studentUserId) {
    await db.insert(quizAttempts).values({
      quizId: row.id,
      studentUserId,
      score: result.score,
      total: result.total,
      percent: result.percent,
      passed,
      markingStatus: result.markingStatus,
      answers: input.answers,
      marks: [],
    });
    await writeAuditLog({
      actor,
      action: "lms.quiz.sit",
      entityType: "quiz",
      entityId: row.id,
      metadata: { studentUserId, ...result, passed },
      ipAddress: ip,
    });
    if (passed) {
      await safeMaybeIssueCertificates(actor, {
        kind: "quiz",
        studentUserId,
        sourceId: row.id,
        sourceTitle: row.title,
        subjectSlug: row.subjectSlug,
        percent: result.percent,
      });
      await safeAwardGamification({
        kind: "quiz",
        studentUserId,
        sourceId: row.id,
        title: row.title,
      });
    }
  }
  const view = await getQuiz(actor, row.id, { studentUserId });
  return {
    ...view,
    result: {
      score: result.score,
      total: result.total,
      percent: result.percent,
      passed,
      markingStatus: result.markingStatus,
      pendingCount: result.pendingCount,
      review: result.review,
    },
  };
}

export async function markQuizAttempt(
  actor: ApiActor,
  input: {
    quizId: string;
    attemptId: string;
    marks: QuizAnswerMark[];
  },
  ip: string,
) {
  requireHumanSensitiveDecision();
  const row = await loadQuizRow(input.quizId);
  if (!row || !canManageRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Quiz not found");
  }
  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.id, input.attemptId), eq(quizAttempts.quizId, row.id)),
    )
    .limit(1);
  if (!attempt) {
    throw new ApiError(404, "NOT_FOUND", "Attempt not found");
  }
  const payload = parseQuizPayload(row.payload);
  const writtenIds = new Set(
    payload.questions
      .filter((question) => question.kind === "written")
      .map((question) => question.id),
  );
  if (!writtenIds.size) {
    throw new ApiError(422, "VALIDATION", "This quiz has no written answers to mark");
  }
  const marks = mergeQuizMarks(
    parseQuizMarks(attempt.marks),
    input.marks,
    writtenIds,
  );
  const result = scoreQuizAttempt(payload, attempt.answers, marks);
  const passed =
    result.markingStatus === "pending"
      ? false
      : quizPercentPassed(result.percent, row.passPercent);
  await db
    .update(quizAttempts)
    .set({
      marks,
      markingStatus: result.markingStatus,
      score: result.score,
      total: result.total,
      percent: result.percent,
      passed,
    })
    .where(eq(quizAttempts.id, attempt.id));
  await writeAuditLog({
    actor,
    action: "lms.quiz.mark",
    entityType: "quiz",
    entityId: row.id,
    metadata: { attemptId: attempt.id, ...result, passed },
    ipAddress: ip,
  });
  if (passed) {
    await safeMaybeIssueCertificates(actor, {
      kind: "quiz",
      studentUserId: attempt.studentUserId,
      sourceId: row.id,
      sourceTitle: row.title,
      subjectSlug: row.subjectSlug,
      percent: result.percent,
    });
    await safeAwardGamification({
      kind: "quiz",
      studentUserId: attempt.studentUserId,
      sourceId: row.id,
      title: row.title,
    });
  }
  return getQuiz(actor, row.id, { studentUserId: attempt.studentUserId });
}
