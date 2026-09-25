export const EDUCATIONAL_GAME_KINDS = [
  "match",
  "memory",
  "order",
  "choice",
] as const;
export type EducationalGameKind = (typeof EDUCATIONAL_GAME_KINDS)[number];

export const EDUCATIONAL_GAME_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;
export type EducationalGameStatus = (typeof EDUCATIONAL_GAME_STATUSES)[number];

export const GAME_MAX_PAIRS = 12;
export const GAME_MAX_ITEMS = 10;
export const GAME_MAX_QUESTIONS = 10;
export const GAME_MAX_CHOICES = 5;
export const GAME_MAX_TEXT = 80;

export type EducationalGamePair = {
  left: string;
  right: string;
};

export type EducationalGameQuestion = {
  prompt: string;
  choices: string[];
  answer: number;
};

export type EducationalGamePayload =
  | { pairs: EducationalGamePair[] }
  | { items: string[]; prompt?: string }
  | { questions: EducationalGameQuestion[] };

export type EducationalGamePlayCard = {
  id: string;
  text: string;
  pairId: string;
};

export type EducationalGamePlayView =
  | { kind: "match"; left: string[]; right: string[] }
  | { kind: "memory"; cards: EducationalGamePlayCard[] }
  | { kind: "order"; items: string[]; prompt?: string }
  | {
      kind: "choice";
      questions: Array<{ prompt: string; choices: string[] }>;
    };

export function gamesHref(roleKey: string, isStaff: boolean, id?: string) {
  const base =
    roleKey === "student"
      ? "/learn/games"
      : roleKey === "parent"
        ? "/family/games"
        : roleKey === "teacher"
          ? "/teach/games"
          : isStaff
            ? "/staff/academic/games"
            : "/learn/games";
  return id ? `${base}/${id}` : base;
}

export function emptyGamePayload(
  kind: EducationalGameKind,
): EducationalGamePayload {
  if (kind === "order") {
    return { items: ["", "", ""], prompt: "" };
  }
  if (kind === "choice") {
    return {
      questions: [{ prompt: "", choices: ["", ""], answer: 0 }],
    };
  }
  return {
    pairs: [
      { left: "", right: "" },
      { left: "", right: "" },
    ],
  };
}

export function isEducationalGameKind(
  value: string,
): value is EducationalGameKind {
  return (EDUCATIONAL_GAME_KINDS as readonly string[]).includes(value);
}

export function shuffleItems<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swap]!;
    next[swap] = current!;
  }
  return next;
}

function clipText(value: string) {
  return value.trim().slice(0, GAME_MAX_TEXT);
}

export function parseGamePayload(
  kind: EducationalGameKind,
  raw: unknown,
): EducationalGamePayload {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (kind === "order") {
    const items = Array.isArray(source.items)
      ? source.items
          .filter((item): item is string => typeof item === "string")
          .slice(0, GAME_MAX_ITEMS)
          .map(clipText)
      : [];
    const prompt =
      typeof source.prompt === "string" ? clipText(source.prompt) : "";
    return { items, prompt: prompt || undefined };
  }
  if (kind === "choice") {
    const questions = Array.isArray(source.questions)
      ? source.questions.slice(0, GAME_MAX_QUESTIONS).map((row) => {
          const question =
            row && typeof row === "object"
              ? (row as Record<string, unknown>)
              : {};
          const choices = Array.isArray(question.choices)
            ? question.choices
                .filter((item): item is string => typeof item === "string")
                .slice(0, GAME_MAX_CHOICES)
                .map(clipText)
            : ["", ""];
          const answer =
            typeof question.answer === "number" &&
            Number.isInteger(question.answer)
              ? Math.min(Math.max(question.answer, 0), Math.max(choices.length - 1, 0))
              : 0;
          return {
            prompt:
              typeof question.prompt === "string"
                ? clipText(question.prompt)
                : "",
            choices: choices.length >= 2 ? choices : [...choices, ""],
            answer,
          };
        })
      : [];
    return { questions };
  }
  const pairs = Array.isArray(source.pairs)
    ? source.pairs.slice(0, GAME_MAX_PAIRS).map((row) => {
        const pair =
          row && typeof row === "object" ? (row as Record<string, unknown>) : {};
        return {
          left: typeof pair.left === "string" ? clipText(pair.left) : "",
          right: typeof pair.right === "string" ? clipText(pair.right) : "",
        };
      })
    : [];
  return { pairs };
}

export function gamePayloadIsPlayable(
  kind: EducationalGameKind,
  payload: EducationalGamePayload,
) {
  if (kind === "order" && "items" in payload) {
    const items = payload.items.map((item) => item.trim()).filter(Boolean);
    return items.length >= 3 && new Set(items).size === items.length;
  }
  if (kind === "choice" && "questions" in payload) {
    return (
      payload.questions.length >= 1 &&
      payload.questions.every(
        (question) =>
          question.prompt.trim() &&
          question.choices.filter((choice) => choice.trim()).length >= 2 &&
          question.answer >= 0 &&
          question.answer < question.choices.length &&
          question.choices[question.answer]?.trim(),
      )
    );
  }
  if ("pairs" in payload) {
    const pairs = payload.pairs.filter(
      (pair) => pair.left.trim() && pair.right.trim(),
    );
    const lefts = pairs.map((pair) => pair.left.trim());
    return pairs.length >= 2 && new Set(lefts).size === lefts.length;
  }
  return false;
}

export function toGamePlayView(
  kind: EducationalGameKind,
  payload: EducationalGamePayload,
): EducationalGamePlayView {
  if (kind === "order" && "items" in payload) {
    return {
      kind,
      items: shuffleItems(payload.items.map((item) => item.trim()).filter(Boolean)),
      prompt: payload.prompt?.trim() || undefined,
    };
  }
  if (kind === "choice" && "questions" in payload) {
    return {
      kind,
      questions: payload.questions.map((question) => ({
        prompt: question.prompt.trim(),
        choices: question.choices.map((choice) => choice.trim()),
      })),
    };
  }
  const pairs =
    "pairs" in payload
      ? payload.pairs.filter((pair) => pair.left.trim() && pair.right.trim())
      : [];
  if (kind === "memory") {
    return {
      kind,
      cards: shuffleItems(
        pairs.flatMap((pair, index) => [
          { id: `${index}-a`, text: pair.left, pairId: String(index) },
          { id: `${index}-b`, text: pair.right, pairId: String(index) },
        ]),
      ),
    };
  }
  return {
    kind: "match",
    left: shuffleItems(pairs.map((pair) => pair.left)),
    right: shuffleItems(pairs.map((pair) => pair.right)),
  };
}

export function scoreGamePlay(
  kind: EducationalGameKind,
  payload: EducationalGamePayload,
  input: {
    pairs?: EducationalGamePair[];
    order?: string[];
    answers?: number[];
  },
) {
  if (kind === "order" && "items" in payload) {
    const expected = payload.items.map((item) => item.trim()).filter(Boolean);
    const got = (input.order ?? []).map((item) => item.trim());
    const score = expected.filter((item, index) => item === got[index]).length;
    return { score, total: expected.length };
  }
  if (kind === "choice" && "questions" in payload) {
    const score = payload.questions.filter(
      (question, index) => input.answers?.[index] === question.answer,
    ).length;
    return { score, total: payload.questions.length };
  }
  const expected =
    "pairs" in payload
      ? payload.pairs.filter((pair) => pair.left.trim() && pair.right.trim())
      : [];
  const map = new Map(
    expected.map((pair) => [pair.left.trim(), pair.right.trim()]),
  );
  const used = new Set<string>();
  let score = 0;
  for (const pair of input.pairs ?? []) {
    const left = pair.left.trim();
    if (used.has(left)) continue;
    if (map.get(left) === pair.right.trim()) {
      used.add(left);
      score += 1;
    }
  }
  return { score, total: expected.length };
}
