import {
  parseQuizPayload,
  quizQuestionIsReady,
  type QuizQuestion,
  type QuizQuestionKind,
} from "@/lib/quizzes";

export const QUESTION_BANK_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;
export type QuestionBankStatus = (typeof QUESTION_BANK_STATUSES)[number];

export type QuestionBankBody =
  | { choices: string[]; answer: number }
  | { answer: boolean }
  | { accepted: string[] }
  | { written: true };

export function questionBankHref(
  roleKey: string,
  isStaff: boolean,
  id?: string,
) {
  const base =
    roleKey === "teacher"
      ? "/teach/questions"
      : isStaff
        ? "/staff/academic/questions"
        : "/teach/questions";
  return id ? `${base}/${id}` : base;
}

export function emptyBankQuestion(kind: QuizQuestionKind): QuizQuestion {
  if (kind === "true_false") {
    return { id: "bank-new", kind, prompt: "", answer: true };
  }
  if (kind === "short") {
    return { id: "bank-new", kind, prompt: "", accepted: [""] };
  }
  if (kind === "written") {
    return { id: "bank-new", kind, prompt: "" };
  }
  return {
    id: "bank-new",
    kind: "choice",
    prompt: "",
    choices: ["", ""],
    answer: 0,
  };
}

export function parseBankQuestion(
  kind: QuizQuestionKind,
  prompt: string,
  body: unknown,
  id = "bank",
): QuizQuestion {
  const parsed = parseQuizPayload({
    questions: [{ id, kind, prompt, ...(body && typeof body === "object" ? body : {}) }],
  }).questions[0];
  return parsed ?? emptyBankQuestion(kind);
}

export function bankBodyFromQuestion(question: QuizQuestion): QuestionBankBody {
  if (question.kind === "choice") {
    return { choices: question.choices, answer: question.answer };
  }
  if (question.kind === "true_false") {
    return { answer: question.answer };
  }
  if (question.kind === "written") {
    return { written: true };
  }
  return { accepted: question.accepted };
}

export function bankItemToQuizQuestion(
  item: { id: string; kind: QuizQuestionKind; prompt: string; body: unknown },
): QuizQuestion {
  const question = parseBankQuestion(item.kind, item.prompt, item.body, `bank-${item.id}`);
  return { ...question, bankId: item.id };
}

export function bankItemIsReady(
  kind: QuizQuestionKind,
  prompt: string,
  body: unknown,
) {
  return quizQuestionIsReady(parseBankQuestion(kind, prompt, body));
}
