export const QUIZ_STATUSES = ["draft", "published", "archived"] as const;
export type QuizStatus = (typeof QUIZ_STATUSES)[number];

export const QUIZ_QUESTION_KINDS = [
  "choice",
  "true_false",
  "short",
  "written",
] as const;
export type QuizQuestionKind = (typeof QUIZ_QUESTION_KINDS)[number];

export const QUIZ_MARKING_STATUSES = ["auto", "pending", "marked"] as const;
export type QuizMarkingStatus = (typeof QUIZ_MARKING_STATUSES)[number];

export const QUIZ_MAX_QUESTIONS = 20;
export const QUIZ_MAX_CHOICES = 6;
export const QUIZ_MAX_ACCEPTED = 6;
export const QUIZ_MAX_PROMPT = 400;
export const QUIZ_MAX_TEXT = 120;
export const QUIZ_MAX_WRITTEN = 2000;

export type QuizChoiceQuestion = {
  id: string;
  kind: "choice";
  prompt: string;
  choices: string[];
  answer: number;
  bankId?: string;
};

export type QuizTrueFalseQuestion = {
  id: string;
  kind: "true_false";
  prompt: string;
  answer: boolean;
  bankId?: string;
};

export type QuizShortQuestion = {
  id: string;
  kind: "short";
  prompt: string;
  accepted: string[];
  bankId?: string;
};

export type QuizWrittenQuestion = {
  id: string;
  kind: "written";
  prompt: string;
  bankId?: string;
};

export type QuizQuestion =
  | QuizChoiceQuestion
  | QuizTrueFalseQuestion
  | QuizShortQuestion
  | QuizWrittenQuestion;

export type QuizPayload = {
  questions: QuizQuestion[];
};

export type QuizSitQuestion =
  | {
      id: string;
      kind: "choice";
      prompt: string;
      choices: string[];
      choiceIndexes: number[];
    }
  | { id: string; kind: "true_false"; prompt: string }
  | { id: string; kind: "short"; prompt: string }
  | { id: string; kind: "written"; prompt: string };

export type QuizSitOrder = {
  questionIds: string[];
  choices: Record<string, number[]>;
};

export type QuizAnswerInput = {
  questionId: string;
  choice?: number;
  trueFalse?: boolean;
  text?: string;
};

export type QuizAnswerMark = {
  questionId: string;
  awarded: number;
  feedback?: string;
};

export type QuizReviewItem = {
  questionId: string;
  kind: QuizQuestionKind;
  prompt: string;
  correct: boolean | null;
  marking: "auto" | "manual";
  given: string;
  expected: string;
  feedback?: string;
};

export function quizzesHref(roleKey: string, isStaff: boolean, id?: string) {
  const base =
    roleKey === "student"
      ? "/learn/quizzes"
      : roleKey === "parent"
        ? "/family/quizzes"
        : roleKey === "teacher"
          ? "/teach/quizzes"
          : isStaff
            ? "/staff/academic/quizzes"
            : "/learn/quizzes";
  return id ? `${base}/${id}` : base;
}

export function emptyQuizPayload(): QuizPayload {
  return {
    questions: [
      {
        id: "q-1",
        kind: "choice",
        prompt: "",
        choices: ["", ""],
        answer: 0,
      },
    ],
  };
}

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function questionId(raw: unknown, index: number) {
  return typeof raw === "string" && raw.trim()
    ? raw.trim().slice(0, 64)
    : `q-${index + 1}`;
}

export function parseQuizPayload(
  raw: unknown,
  maxQuestions = QUIZ_MAX_QUESTIONS,
): QuizPayload {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rows = Array.isArray(source.questions) ? source.questions : [];
  const questions = rows.slice(0, maxQuestions).map((row, index) => {
    const question =
      row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const kind = QUIZ_QUESTION_KINDS.includes(question.kind as QuizQuestionKind)
      ? (question.kind as QuizQuestionKind)
      : "choice";
    const prompt =
      typeof question.prompt === "string"
        ? clip(question.prompt, QUIZ_MAX_PROMPT)
        : "";
    const id = questionId(question.id, index);
    const bankId =
      typeof question.bankId === "string" && question.bankId.trim()
        ? question.bankId.trim().slice(0, 64)
        : undefined;
    if (kind === "true_false") {
      return {
        id,
        kind,
        prompt,
        answer: question.answer === true || question.answer === "true",
        bankId,
      } satisfies QuizTrueFalseQuestion;
    }
    if (kind === "short") {
      const accepted = Array.isArray(question.accepted)
        ? question.accepted
            .filter((item): item is string => typeof item === "string")
            .slice(0, QUIZ_MAX_ACCEPTED)
            .map((item) => clip(item, QUIZ_MAX_TEXT))
        : [];
      return {
        id,
        kind,
        prompt,
        accepted: accepted.length ? accepted : [""],
        bankId,
      } satisfies QuizShortQuestion;
    }
    if (kind === "written") {
      return { id, kind, prompt, bankId } satisfies QuizWrittenQuestion;
    }
    const choices = Array.isArray(question.choices)
      ? question.choices
          .filter((item): item is string => typeof item === "string")
          .slice(0, QUIZ_MAX_CHOICES)
          .map((item) => clip(item, QUIZ_MAX_TEXT))
      : ["", ""];
    const answer =
      typeof question.answer === "number" && Number.isInteger(question.answer)
        ? Math.min(Math.max(question.answer, 0), Math.max(choices.length - 1, 0))
        : 0;
    return {
      id,
      kind: "choice",
      prompt,
      choices: choices.length >= 2 ? choices : [...choices, ""],
      answer,
      bankId,
    } satisfies QuizChoiceQuestion;
  });
  return { questions };
}

export function quizQuestionIsReady(question: QuizQuestion) {
  if (!question.prompt.trim()) return false;
  if (question.kind === "choice") {
    return (
      question.choices.filter((choice) => choice.trim()).length >= 2 &&
      Boolean(question.choices[question.answer]?.trim())
    );
  }
  if (question.kind === "short") {
    return question.accepted.some((item) => item.trim());
  }
  return true;
}

export function quizPayloadIsReady(payload: QuizPayload) {
  return (
    payload.questions.length >= 1 &&
    payload.questions.every((question) => quizQuestionIsReady(question))
  );
}

function shuffleItems<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swap]!;
    next[swap] = current!;
  }
  return next;
}

function choiceIndexList(length: number, raw?: number[]) {
  const authored = Array.from({ length }, (_, index) => index);
  if (!raw?.length) return authored;
  const seen = new Set<number>();
  const next: number[] = [];
  for (const index of raw) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= length ||
      seen.has(index)
    ) {
      continue;
    }
    seen.add(index);
    next.push(index);
  }
  for (const index of authored) {
    if (!seen.has(index)) next.push(index);
  }
  return next;
}

export function createQuizSitOrder(payload: QuizPayload): QuizSitOrder {
  const questions = shuffleItems(payload.questions);
  const choices: Record<string, number[]> = {};
  for (const question of questions) {
    if (question.kind === "choice") {
      choices[question.id] = shuffleItems(
        question.choices.map((_, index) => index),
      );
    }
  }
  return {
    questionIds: questions.map((question) => question.id),
    choices,
  };
}

export function parseQuizSitOrder(
  raw: unknown,
  payload: QuizPayload,
): QuizSitOrder | null {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawIds = Array.isArray(source.questionIds) ? source.questionIds : [];
  const rawChoices =
    source.choices && typeof source.choices === "object"
      ? (source.choices as Record<string, unknown>)
      : {};
  const known = payload.questions.map((question) => question.id);
  if (!known.length) return null;
  const seen = new Set<string>();
  const questionIds: string[] = [];
  for (const id of rawIds) {
    if (typeof id !== "string" || !known.includes(id) || seen.has(id)) continue;
    seen.add(id);
    questionIds.push(id);
  }
  if (!questionIds.length && !Object.keys(rawChoices).length) return null;
  for (const id of known) {
    if (!seen.has(id)) questionIds.push(id);
  }
  const choices: Record<string, number[]> = {};
  for (const question of payload.questions) {
    if (question.kind !== "choice") continue;
    const rawListed = rawChoices[question.id];
    const listed = Array.isArray(rawListed)
      ? rawListed.filter((item): item is number => typeof item === "number")
      : undefined;
    choices[question.id] = choiceIndexList(question.choices.length, listed);
  }
  return { questionIds, choices };
}

export function orderQuizQuestions<T extends { id?: string; questionId?: string }>(
  items: T[],
  order?: QuizSitOrder | null,
): T[] {
  if (!order?.questionIds.length) return items;
  const key = (item: T) => item.id ?? item.questionId ?? "";
  const byId = new Map(items.map((item) => [key(item), item]));
  const next: T[] = [];
  const seen = new Set<string>();
  for (const id of order.questionIds) {
    const item = byId.get(id);
    if (!item || seen.has(id)) continue;
    seen.add(id);
    next.push(item);
  }
  for (const item of items) {
    const id = key(item);
    if (!seen.has(id)) next.push(item);
  }
  return next;
}

export function toQuizSitView(
  payload: QuizPayload,
  order?: QuizSitOrder | null,
): QuizSitQuestion[] {
  return orderQuizQuestions(payload.questions, order).map((question) => {
    if (question.kind === "choice") {
      const choiceIndexes = choiceIndexList(
        question.choices.length,
        order?.choices[question.id],
      );
      return {
        id: question.id,
        kind: "choice",
        prompt: question.prompt,
        choices: choiceIndexes.map((index) => question.choices[index] ?? ""),
        choiceIndexes,
      };
    }
    if (question.kind === "true_false") {
      return { id: question.id, kind: "true_false", prompt: question.prompt };
    }
    if (question.kind === "written") {
      return { id: question.id, kind: "written", prompt: question.prompt };
    }
    return { id: question.id, kind: "short", prompt: question.prompt };
  });
}

function givenLabel(
  question: QuizQuestion,
  answer?: QuizAnswerInput,
) {
  if (question.kind === "choice") {
    return question.choices[answer?.choice ?? -1]?.trim() || "";
  }
  if (question.kind === "true_false") {
    if (answer?.trueFalse === undefined) return "";
    return answer.trueFalse ? "true" : "false";
  }
  return answer?.text?.trim() || "";
}

function expectedLabel(question: QuizQuestion) {
  if (question.kind === "choice") {
    return question.choices[question.answer]?.trim() || "";
  }
  if (question.kind === "true_false") {
    return question.answer ? "true" : "false";
  }
  if (question.kind === "written") return "";
  return question.accepted.map((item) => item.trim()).filter(Boolean).join(" / ");
}

export function parseQuizMarks(raw: unknown): QuizAnswerMark[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const questionId =
        typeof item.questionId === "string" ? item.questionId.trim().slice(0, 64) : "";
      if (!questionId) return null;
      const awarded = item.awarded === 1 || item.awarded === true ? 1 : 0;
      const feedback =
        typeof item.feedback === "string" ? clip(item.feedback, QUIZ_MAX_PROMPT) : "";
      return {
        questionId,
        awarded,
        ...(feedback ? { feedback } : {}),
      } satisfies QuizAnswerMark;
    })
    .filter((item): item is QuizAnswerMark => Boolean(item));
}

export function mergeQuizMarks(
  current: QuizAnswerMark[],
  incoming: QuizAnswerMark[],
  writtenIds: Set<string>,
) {
  const next = new Map(
    current
      .filter((mark) => writtenIds.has(mark.questionId))
      .map((mark) => [mark.questionId, mark]),
  );
  for (const mark of incoming) {
    if (!writtenIds.has(mark.questionId)) continue;
    next.set(mark.questionId, {
      questionId: mark.questionId,
      awarded: mark.awarded ? 1 : 0,
      ...(mark.feedback?.trim()
        ? { feedback: clip(mark.feedback, QUIZ_MAX_PROMPT) }
        : {}),
    });
  }
  return [...next.values()];
}

export function scoreQuizAttempt(
  payload: QuizPayload,
  answers: QuizAnswerInput[],
  marks: QuizAnswerMark[] = [],
) {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));
  const byMark = new Map(marks.map((mark) => [mark.questionId, mark]));
  const review: QuizReviewItem[] = payload.questions.map((question) => {
    const answer = byId.get(question.id);
    if (question.kind === "written") {
      const mark = byMark.get(question.id);
      return {
        questionId: question.id,
        kind: question.kind,
        prompt: question.prompt,
        correct: mark ? mark.awarded === 1 : null,
        marking: "manual",
        given: givenLabel(question, answer),
        expected: "",
        feedback: mark?.feedback,
      };
    }
    let correct = false;
    if (question.kind === "choice") {
      correct = answer?.choice === question.answer;
    } else if (question.kind === "true_false") {
      correct = answer?.trueFalse === question.answer;
    } else {
      const given = normalizeAnswer(answer?.text ?? "");
      correct =
        given.length > 0 &&
        question.accepted.some((item) => normalizeAnswer(item) === given);
    }
    return {
      questionId: question.id,
      kind: question.kind,
      prompt: question.prompt,
      correct,
      marking: "auto",
      given: givenLabel(question, answer),
      expected: expectedLabel(question),
    };
  });
  const pendingCount = review.filter((item) => item.correct === null).length;
  const hasManual = review.some((item) => item.marking === "manual");
  const markingStatus: QuizMarkingStatus = !hasManual
    ? "auto"
    : pendingCount
      ? "pending"
      : "marked";
  const score = review.filter((item) => item.correct === true).length;
  const total = review.length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  return { score, total, percent, pendingCount, markingStatus, review };
}

export function quizPercentPassed(percent: number, passPercent: number) {
  return percent >= passPercent;
}
