import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { questionBankItems, subjects, users } from "@/db/schema";
import {
  bankBodyFromQuestion,
  bankItemIsReady,
  emptyBankQuestion,
  parseBankQuestion,
  questionBankHref,
  type QuestionBankBody,
  type QuestionBankStatus,
} from "@/lib/question-bank";
import {
  quizQuestionIsReady,
  type QuizQuestion,
  type QuizQuestionKind,
} from "@/lib/quizzes";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { getTeacherVerificationStatus } from "@/server/teacher/onboarding";

export type QuestionBankView = {
  id: string;
  prompt: string;
  kind: QuizQuestionKind;
  topic: string | null;
  subjectSlug: string | null;
  subjectName: string | null;
  status: QuestionBankStatus;
  teacherName: string;
  href: string;
  canManage: boolean;
  question: QuizQuestion;
};

export type QuestionBankDesk = {
  subjects: Array<{ slug: string; name: string }>;
  items: QuestionBankView[];
};

function isStaffCurriculum(actor: ApiActor) {
  return hasAnyPermission(actor, "academic.curriculum");
}

async function canAuthorBank(actor: ApiActor) {
  if (isStaffCurriculum(actor)) return true;
  if (actor.roleKey !== "teacher") return false;
  const status = await getTeacherVerificationStatus(actor.userId);
  return status === "approved";
}

function bankPath(actor: ApiActor, id?: string) {
  return questionBankHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffCurriculum(actor),
    id,
  );
}

function canManageRow(actor: ApiActor, row: { createdByUserId: string }) {
  return isStaffCurriculum(actor) || row.createdByUserId === actor.userId;
}

function canSeeRow(
  actor: ApiActor,
  row: { status: QuestionBankStatus; createdByUserId: string },
) {
  if (!(actor.roleKey === "teacher" || isStaffRole(actor.roleKey) || isStaffCurriculum(actor))) {
    return false;
  }
  if (canManageRow(actor, row)) return true;
  return row.status === "published";
}

async function assertSubject(subjectSlug: string | null) {
  if (!subjectSlug) return;
  const [subject] = await db
    .select({ slug: subjects.slug })
    .from(subjects)
    .where(eq(subjects.slug, subjectSlug))
    .limit(1);
  if (!subject) {
    throw new ApiError(422, "VALIDATION", "Choose a published subject");
  }
}

function toView(
  actor: ApiActor,
  row: {
    id: string;
    prompt: string;
    kind: QuizQuestionKind;
    topic: string | null;
    subjectSlug: string | null;
    subjectName: string | null;
    status: QuestionBankStatus;
    body: QuestionBankBody;
    createdByUserId: string;
    teacherName: string | null;
  },
): QuestionBankView {
  return {
    id: row.id,
    prompt: row.prompt,
    kind: row.kind,
    topic: row.topic,
    subjectSlug: row.subjectSlug,
    subjectName: row.subjectName,
    status: row.status,
    teacherName: row.teacherName ?? "Teacher",
    href: bankPath(actor, row.id),
    canManage: canManageRow(actor, row),
    question: parseBankQuestion(row.kind, row.prompt, row.body, row.id),
  };
}

export async function listQuestionBank(
  actor: ApiActor,
  filters?: {
    subjectSlug?: string;
    kind?: QuizQuestionKind;
    topic?: string;
  },
): Promise<QuestionBankView[]> {
  if (!(await canAuthorBank(actor))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot open the question bank");
  }
  const teacherOnlyOwnDrafts =
    actor.roleKey === "teacher" && !isStaffCurriculum(actor);
  const clauses = [];
  if (teacherOnlyOwnDrafts) {
    clauses.push(
      or(
        eq(questionBankItems.createdByUserId, actor.userId),
        eq(questionBankItems.status, "published"),
      ),
    );
  }
  if (filters?.subjectSlug) {
    clauses.push(eq(questionBankItems.subjectSlug, filters.subjectSlug));
  }
  if (filters?.kind) {
    clauses.push(eq(questionBankItems.kind, filters.kind));
  }

  const rows = await db
    .select({
      id: questionBankItems.id,
      prompt: questionBankItems.prompt,
      kind: questionBankItems.kind,
      topic: questionBankItems.topic,
      subjectSlug: questionBankItems.subjectSlug,
      subjectName: subjects.name,
      status: questionBankItems.status,
      body: questionBankItems.body,
      createdByUserId: questionBankItems.createdByUserId,
      teacherName: users.displayName,
    })
    .from(questionBankItems)
    .leftJoin(subjects, eq(subjects.slug, questionBankItems.subjectSlug))
    .innerJoin(users, eq(users.id, questionBankItems.createdByUserId))
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(questionBankItems.updatedAt));

  const topic = filters?.topic?.trim().toLowerCase();
  return rows
    .filter((row) => canSeeRow(actor, row))
    .filter((row) =>
      topic ? (row.topic ?? "").toLowerCase().includes(topic) : true,
    )
    .map((row) => toView(actor, row));
}

export async function listQuestionBankDesk(
  actor: ApiActor,
  filters?: {
    subjectSlug?: string;
    kind?: QuizQuestionKind;
    topic?: string;
  },
): Promise<QuestionBankDesk> {
  if (!(await canAuthorBank(actor))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot open the question bank");
  }
  const [subjectRows, items] = await Promise.all([
    db
      .select({ slug: subjects.slug, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.isEnabled, true))
      .orderBy(subjects.sortOrder),
    listQuestionBank(actor, filters),
  ]);
  return { subjects: subjectRows, items };
}

export async function getQuestionBankItem(actor: ApiActor, id: string) {
  if (!(await canAuthorBank(actor))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot open the question bank");
  }
  const [row] = await db
    .select({
      id: questionBankItems.id,
      prompt: questionBankItems.prompt,
      kind: questionBankItems.kind,
      topic: questionBankItems.topic,
      subjectSlug: questionBankItems.subjectSlug,
      subjectName: subjects.name,
      status: questionBankItems.status,
      body: questionBankItems.body,
      createdByUserId: questionBankItems.createdByUserId,
      teacherName: users.displayName,
    })
    .from(questionBankItems)
    .leftJoin(subjects, eq(subjects.slug, questionBankItems.subjectSlug))
    .innerJoin(users, eq(users.id, questionBankItems.createdByUserId))
    .where(eq(questionBankItems.id, id))
    .limit(1);
  if (!row || !canSeeRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Question not found");
  }
  return toView(actor, row);
}

export async function createQuestionBankItem(
  actor: ApiActor,
  input: {
    prompt?: string;
    kind: QuizQuestionKind;
    topic?: string;
    subjectSlug?: string;
    question?: unknown;
  },
  ip: string,
) {
  if (!(await canAuthorBank(actor))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot add to the question bank");
  }
  const question = parseBankQuestion(
    input.kind,
    input.prompt ?? "",
    input.question ?? emptyBankQuestion(input.kind),
  );
  const prompt = (input.prompt?.trim() || question.prompt).trim();
  if (prompt.length < 2) {
    throw new ApiError(422, "VALIDATION", "Enter a question prompt");
  }
  const subjectSlug = input.subjectSlug?.trim() || null;
  await assertSubject(subjectSlug);
  const ready = parseBankQuestion(input.kind, prompt, question);
  const [created] = await db
    .insert(questionBankItems)
    .values({
      prompt,
      kind: input.kind,
      topic: input.topic?.trim() || null,
      subjectSlug,
      body: bankBodyFromQuestion(ready),
      createdByUserId: actor.userId,
    })
    .returning({ id: questionBankItems.id });
  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not save the question");
  }
  await writeAuditLog({
    actor,
    action: "lms.question_bank.create",
    entityType: "question_bank_item",
    entityId: created.id,
    ipAddress: ip,
  });
  return listQuestionBankDesk(actor);
}

export async function saveQuestionBankItem(
  actor: ApiActor,
  input: {
    id: string;
    prompt?: string;
    kind?: QuizQuestionKind;
    topic?: string;
    subjectSlug?: string;
    status?: QuestionBankStatus;
    question?: unknown;
  },
  ip: string,
) {
  const current = await getQuestionBankItem(actor, input.id);
  if (!current.canManage) {
    throw new ApiError(404, "NOT_FOUND", "Question not found");
  }
  const kind = input.kind ?? current.kind;
  const question = parseBankQuestion(
    kind,
    input.prompt ?? current.question.prompt,
    input.question ?? current.question,
    current.id,
  );
  const prompt = question.prompt.trim();
  if (prompt.length < 2) {
    throw new ApiError(422, "VALIDATION", "Enter a question prompt");
  }
  const subjectSlug =
    input.subjectSlug === undefined
      ? current.subjectSlug
      : input.subjectSlug.trim() || null;
  await assertSubject(subjectSlug);
  if (input.status === "published" && !quizQuestionIsReady(question)) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Finish the question before publishing",
    );
  }
  await db
    .update(questionBankItems)
    .set({
      prompt,
      kind,
      topic:
        input.topic === undefined ? current.topic : input.topic.trim() || null,
      subjectSlug,
      ...(input.status ? { status: input.status } : {}),
      body: bankBodyFromQuestion(question),
    })
    .where(eq(questionBankItems.id, current.id));
  await writeAuditLog({
    actor,
    action: "lms.question_bank.save",
    entityType: "question_bank_item",
    entityId: current.id,
    ipAddress: ip,
  });
  return getQuestionBankItem(actor, current.id);
}

export async function loadReadyBankQuestions(
  actor: ApiActor,
  ids: string[],
): Promise<QuizQuestion[]> {
  if (!(await canAuthorBank(actor))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot open the question bank");
  }
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  const rows = await db
    .select({
      id: questionBankItems.id,
      prompt: questionBankItems.prompt,
      kind: questionBankItems.kind,
      body: questionBankItems.body,
      status: questionBankItems.status,
      createdByUserId: questionBankItems.createdByUserId,
    })
    .from(questionBankItems)
    .where(inArray(questionBankItems.id, unique));
  const questions: QuizQuestion[] = [];
  for (const row of rows) {
    if (!canSeeRow(actor, row)) continue;
    const question = parseBankQuestion(row.kind, row.prompt, row.body, `bank-${row.id}`);
    if (!bankItemIsReady(row.kind, row.prompt, row.body)) continue;
    questions.push({ ...question, bankId: row.id });
  }
  return questions;
}
