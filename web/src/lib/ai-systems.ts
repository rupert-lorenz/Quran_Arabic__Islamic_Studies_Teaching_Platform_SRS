export const AI_JOB_KINDS = [
  "transcription",
  "summary",
  "notes",
  "homework",
  "quiz",
  "recommendation",
  "search",
] as const;
export type AiJobKind = (typeof AI_JOB_KINDS)[number];

export const AI_JOB_STATUSES = [
  "queued",
  "processing",
  "ready",
  "needs_review",
  "approved",
  "rejected",
  "failed",
] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export const AI_SOURCE_TYPES = [
  "classroom",
  "recording",
  "material",
  "upload",
  "topic",
] as const;
export type AiSourceType = (typeof AI_SOURCE_TYPES)[number];

export const AI_LOCALES = ["en", "ar"] as const;
export type AiLocale = (typeof AI_LOCALES)[number];

export const AI_SPEAKER_ROLES = [
  "teacher",
  "student",
  "parent",
  "staff",
  "unknown",
] as const;
export type AiSpeakerRole = (typeof AI_SPEAKER_ROLES)[number];

export const AI_LIVE_KINDS = [
  "transcription",
  "search",
  "summary",
  "notes",
  "homework",
  "quiz",
  "recommendation",
] as const;
export const AI_PLANNED_KINDS = [] as const;

export const AI_QUIZ_SOURCES = ["lesson", "book", "topic", "upload", "previous"] as const;
export type AiQuizSource = (typeof AI_QUIZ_SOURCES)[number];

export function isAiQuizSource(value: string): value is AiQuizSource {
  return (AI_QUIZ_SOURCES as readonly string[]).includes(value);
}

export const AI_TRANSCRIPT_SOURCES = ["speech", "chat", "typed", "mixed"] as const;
export type AiTranscriptSource = (typeof AI_TRANSCRIPT_SOURCES)[number];

export type AiTranscriptSegment = {
  speakerRole: AiSpeakerRole;
  speakerName: string;
  speakerUserId?: string;
  at?: string;
  startMs?: number;
  confidence?: number;
  source?: AiTranscriptSource;
  body: string;
};

export function isAiTranscriptSource(value: string): value is AiTranscriptSource {
  return (AI_TRANSCRIPT_SOURCES as readonly string[]).includes(value);
}

export const ARABIC_RECOGNITION_LANGS = ["ar-SA", "ar-EG", "ar", "ar-AE"] as const;

export function speechRecognitionLang(locale: AiLocale) {
  return locale === "ar" ? ARABIC_RECOGNITION_LANGS[0] : "en-GB";
}

export function speechRecognitionLangs(locale: AiLocale) {
  return locale === "ar" ? [...ARABIC_RECOGNITION_LANGS] : [speechRecognitionLang(locale)];
}

export function classroomRecordingPlaybackHref(
  classroomId: string,
  recordingId: string,
) {
  return `/api/v1/classrooms/${classroomId}/recordings/${recordingId}`;
}

export function isAiJobKind(value: string): value is AiJobKind {
  return (AI_JOB_KINDS as readonly string[]).includes(value);
}

export function isAiJobStatus(value: string): value is AiJobStatus {
  return (AI_JOB_STATUSES as readonly string[]).includes(value);
}

export function isAiLocale(value: string): value is AiLocale {
  return (AI_LOCALES as readonly string[]).includes(value);
}

export function isAiSpeakerRole(value: string): value is AiSpeakerRole {
  return (AI_SPEAKER_ROLES as readonly string[]).includes(value);
}

export const AI_ACADEMIC_KINDS = [
  "transcription",
  "summary",
  "homework",
  "quiz",
  "recommendation",
] as const;
export type AiAcademicKind = (typeof AI_ACADEMIC_KINDS)[number];

export function isAcademicAiKind(kind: string): kind is AiAcademicKind {
  return (AI_ACADEMIC_KINDS as readonly string[]).includes(kind);
}

export function aiKindRequiresReview(kind: AiJobKind) {
  return kind !== "search" && kind !== "notes";
}

export function aiJobIsPendingReview(
  status: AiJobStatus,
  requiresReview = true,
) {
  return requiresReview && (status === "needs_review" || status === "processing");
}

export const AI_CONTENT_ORIGINS = ["ai", "human", "ai_assisted"] as const;
export type AiContentOrigin = (typeof AI_CONTENT_ORIGINS)[number];

export function isAiContentOrigin(value: unknown): value is AiContentOrigin {
  return (
    typeof value === "string" &&
    (AI_CONTENT_ORIGINS as readonly string[]).includes(value)
  );
}

export function resolveAiContentOrigin(input: {
  nowGeneratedByAi: boolean;
  previousOrigin?: AiContentOrigin | null;
}): AiContentOrigin {
  const previous = input.previousOrigin ?? null;
  if (previous === "ai" || previous === "ai_assisted") {
    return input.nowGeneratedByAi ? previous : "ai_assisted";
  }
  if (previous === "human") {
    return input.nowGeneratedByAi ? "ai_assisted" : "human";
  }
  return input.nowGeneratedByAi ? "ai" : "human";
}

export function aiContentIsIdentified(origin: AiContentOrigin) {
  return origin !== "human";
}

export function payloadAiOrigin(
  payload: Record<string, unknown> | null | undefined,
  generatedByAi = false,
): AiContentOrigin {
  const identification = payload?.identification;
  if (identification && typeof identification === "object") {
    const origin = (identification as { origin?: unknown }).origin;
    if (isAiContentOrigin(origin)) return origin;
  }
  if (isAiContentOrigin(payload?.origin)) return payload.origin;
  return generatedByAi ? "ai" : "human";
}

export function looksArabic(text: string) {
  const letters = text.replace(/\s+/g, "");
  if (!letters.length) return false;
  const arabic = (letters.match(/\p{Script=Arabic}/gu) ?? []).length;
  return arabic / letters.length >= 0.25;
}

export function looksEnglish(text: string) {
  const letters = text.replace(/\s+/g, "");
  if (!letters.length) return false;
  const latin = (letters.match(/\p{Script=Latin}/gu) ?? []).length;
  return latin / letters.length >= 0.25;
}

export function detectAiLocale(text: string, requested?: AiLocale): AiLocale {
  if (requested) return requested;
  if (looksArabic(text) && !looksEnglish(text)) return "ar";
  return "en";
}

export function normaliseEnglishTranscript(text: string) {
  let body = text.replace(/\s+/g, " ").trim();
  if (!body) return body;
  body = body.replace(/\s+([,.;:!?])/g, "$1");
  body = body.replace(/([.!?])([A-Za-z])/g, "$1 $2");
  body = body.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead: string, letter: string) => {
    return `${lead}${letter.toUpperCase()}`;
  });
  body = body.replace(/\bi\b/g, "I");
  return body;
}

export function applyEnglishTranscriptSegments(segments: AiTranscriptSegment[]) {
  return segments.map((item) => ({
    ...item,
    body: normaliseEnglishTranscript(item.body),
  }));
}

export function normaliseArabicTranscript(text: string) {
  let body = text.replace(/\s+/g, " ").trim();
  if (!body) return body;
  body = body.replace(/\u0640+/g, "");
  body = body.replace(/\s+([،؛؟.!?])/g, "$1");
  body = body.replace(/([.!?؟])(\S)/g, "$1 $2");
  return body;
}

export function applyArabicTranscriptSegments(segments: AiTranscriptSegment[]) {
  return segments.map((item) => ({
    ...item,
    body: normaliseArabicTranscript(item.body),
  }));
}

export function prepareTranscriptSegments(
  segments: AiTranscriptSegment[],
  locale: AiLocale,
) {
  if (locale === "en") return applyEnglishTranscriptSegments(segments);
  if (locale === "ar") return applyArabicTranscriptSegments(segments);
  return segments;
}

export function aiProgressHref(
  roleKey: string,
  isStaff: boolean,
  studentUserId?: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/ai"
      : roleKey === "parent"
        ? "/family/ai"
        : roleKey === "teacher"
          ? "/teach/ai"
          : isStaff
            ? "/staff/academic/ai"
            : "/learn/ai";
  if (!studentUserId || roleKey === "student") return base;
  return `${base}?student=${studentUserId}`;
}

export function familyChildAiHref(studentUserId: string) {
  return `/family/children/${studentUserId}/ai`;
}

export function transcriptSearchPattern(query: string) {
  const cleaned = query
    .trim()
    .replace(/[%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? `%${cleaned}%` : "";
}

export function countTranscriptQueryMatches(
  input: {
    classroomTitle: string;
    fullText: string;
    segments: AiTranscriptSegment[];
  },
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return { matchCount: 0, matchedIndexes: [] as number[] };
  let matchCount = 0;
  const matchedIndexes: number[] = [];
  if (input.classroomTitle.toLowerCase().includes(needle)) matchCount += 1;
  if (input.fullText.toLowerCase().includes(needle)) matchCount += 1;
  input.segments.forEach((segment, index) => {
    const hay = `${segment.speakerName} ${segment.body}`.toLowerCase();
    if (hay.includes(needle)) {
      matchCount += 1;
      matchedIndexes.push(index);
    }
  });
  return { matchCount, matchedIndexes };
}

export function highlightTranscriptParts(text: string, query: string) {
  const needle = query.trim();
  if (!needle || !text) return [{ text, match: false }];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      match: part.toLowerCase() === needle.toLowerCase(),
    }));
}

export type AiSpeakerView = {
  key: string;
  name: string;
  role: AiSpeakerRole;
  identified: boolean;
  segmentCount: number;
};

const GENERIC_SPEAKER_NAMES = new Set(["speaker", "متحدث", "unknown", ""]);

const SPEAKER_ROLE_LABELS: Record<string, AiSpeakerRole> = {
  teacher: "teacher",
  student: "student",
  parent: "parent",
  staff: "staff",
  speaker: "unknown",
  معلم: "teacher",
  معلمة: "teacher",
  طالب: "student",
  طالبة: "student",
  "ولي أمر": "parent",
  "ولي الامر": "parent",
  موظف: "staff",
  موظفة: "staff",
  متحدث: "unknown",
};

const SPEAKER_ROLE_ORDER: Record<AiSpeakerRole, number> = {
  teacher: 0,
  staff: 1,
  student: 2,
  parent: 3,
  unknown: 4,
};

export function genericSpeakerName(locale: AiLocale) {
  return locale === "ar" ? "متحدث" : "Speaker";
}

export function speakerRoleFromActor(roleKey: string, isStaff = false): AiSpeakerRole {
  if (isAiSpeakerRole(roleKey)) return roleKey;
  if (isStaff) return "staff";
  return "unknown";
}

export function speakerKey(
  segment: Pick<AiTranscriptSegment, "speakerUserId" | "speakerName" | "speakerRole">,
) {
  if (segment.speakerUserId) return `user:${segment.speakerUserId}`;
  const name = segment.speakerName.trim().toLowerCase();
  if (name && !GENERIC_SPEAKER_NAMES.has(name)) return `name:${name}`;
  return `role:${segment.speakerRole}`;
}

export function isIdentifiedSpeaker(segment: AiTranscriptSegment) {
  if (segment.speakerUserId) return true;
  const name = segment.speakerName.trim().toLowerCase();
  return Boolean(name) && !GENERIC_SPEAKER_NAMES.has(name);
}

export function distinctTranscriptSpeakers(segments: AiTranscriptSegment[]): AiSpeakerView[] {
  const map = new Map<string, AiSpeakerView>();
  for (const segment of segments) {
    const key = speakerKey(segment);
    const current = map.get(key);
    if (current) {
      current.segmentCount += 1;
      if (!current.identified && isIdentifiedSpeaker(segment)) {
        current.identified = true;
        current.name = segment.speakerName.trim() || current.name;
        current.role = segment.speakerRole;
      }
    } else {
      map.set(key, {
        key,
        name: segment.speakerName.trim() || genericSpeakerName("en"),
        role: segment.speakerRole,
        identified: isIdentifiedSpeaker(segment),
        segmentCount: 1,
      });
    }
  }
  return [...map.values()].sort((left, right) => {
    const role = SPEAKER_ROLE_ORDER[left.role] - SPEAKER_ROLE_ORDER[right.role];
    if (role) return role;
    return left.name.localeCompare(right.name);
  });
}

function segmentSortTime(segment: AiTranscriptSegment) {
  if (typeof segment.startMs === "number") return segment.startMs;
  if (segment.at) {
    const time = Date.parse(segment.at);
    if (!Number.isNaN(time)) return time;
  }
  return null;
}

export function sortTranscriptSegments(segments: AiTranscriptSegment[]) {
  return segments
    .map((segment, index) => ({ segment, index }))
    .sort((left, right) => {
      const leftTime = segmentSortTime(left.segment);
      const rightTime = segmentSortTime(right.segment);
      if (leftTime != null && rightTime != null && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return left.index - right.index;
    })
    .map((item) => item.segment);
}

export function speakerRoleFromLabel(label: string): AiSpeakerRole {
  const exact = SPEAKER_ROLE_LABELS[label.trim()];
  if (exact) return exact;
  return SPEAKER_ROLE_LABELS[label.trim().toLowerCase()] ?? "unknown";
}

export function parseTypedSpeakerLine(line: string, locale: AiLocale): AiTranscriptSegment {
  const trimmed = line.trim();
  const match = trimmed.match(
    /^([\p{L}][\p{L}\p{M}\d'’.\- ]{0,60}?)\s*[:：]\s+(.+)$/u,
  );
  if (!match?.[1] || !match[2]) {
    return {
      speakerRole: "unknown",
      speakerName: genericSpeakerName(locale),
      source: "typed",
      body: trimmed,
    };
  }
  const label = match[1].trim();
  return {
    speakerRole: speakerRoleFromLabel(label),
    speakerName: label,
    source: "typed",
    body: match[2].trim(),
  };
}

export function segmentsFromTypedBody(body: string, locale: AiLocale) {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseTypedSpeakerLine(line, locale));
}

export function sameTranscriptSegment(
  left: AiTranscriptSegment,
  right: AiTranscriptSegment,
) {
  return (
    left.body === right.body &&
    (left.speakerUserId || left.speakerName) ===
      (right.speakerUserId || right.speakerName) &&
    (left.at || "") === (right.at || "")
  );
}

export function speakerToneClass(role: AiSpeakerRole) {
  if (role === "teacher") return "border-l-4 border-[#CB9F64]";
  if (role === "student") return "border-l-4 border-[#294634]";
  if (role === "staff") return "border-l-4 border-[#3B563F]";
  if (role === "parent") return "border-l-4 border-[#CB9F64]";
  return "border-l-4 border-[#5E6B63]";
}

export type AiLessonSummaryDraft = {
  body: string;
  sentenceCount: number;
  keyPoints: string[];
  vocabulary: string[];
  improvementAreas: string[];
  nextLessonRecommendations: string[];
  engine: "extractive";
};

const ENGLISH_SUMMARY_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "i",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "she",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "with",
  "you",
  "your",
]);

const ARABIC_SUMMARY_STOPWORDS = new Set([
  "أن",
  "إن",
  "إلى",
  "التي",
  "الذي",
  "أو",
  "ثم",
  "على",
  "عن",
  "في",
  "قد",
  "كان",
  "كانت",
  "لا",
  "ما",
  "مع",
  "من",
  "هذا",
  "هذه",
  "هو",
  "هي",
  "و",
]);

function splitLessonSentences(text: string, locale: AiLocale) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [] as string[];
  const parts =
    locale === "ar"
      ? cleaned.split(/(?<=[.!?؟])\s+/)
      : cleaned.split(/(?<=[.!?])\s+/);
  return parts.map((part) => part.trim()).filter((part) => part.length > 1);
}

function summaryTokens(text: string, locale: AiLocale) {
  const words = text.toLowerCase().match(/[\p{L}\p{M}]+/gu) ?? [];
  const stop = locale === "ar" ? ARABIC_SUMMARY_STOPWORDS : ENGLISH_SUMMARY_STOPWORDS;
  const minLength = locale === "ar" ? 2 : 3;
  return words.filter((word) => word.length >= minLength && !stop.has(word));
}

export function summariseLessonTranscript(input: {
  fullText: string;
  segments?: AiTranscriptSegment[];
  locale: AiLocale;
}): AiLessonSummaryDraft {
  const source = input.segments?.length
    ? input.segments.map((item) => item.body.trim()).filter(Boolean).join(" ")
    : input.fullText.replace(/^[^:\n]{1,80}:\s*/gm, " ");
  const prepared =
    input.locale === "ar"
      ? normaliseArabicTranscript(source)
      : normaliseEnglishTranscript(source);
  const sentences = splitLessonSentences(prepared, input.locale);
  if (!sentences.length) {
    return {
      body: "",
      sentenceCount: 0,
      keyPoints: [],
      vocabulary: [],
      improvementAreas: [],
      nextLessonRecommendations: [],
      engine: "extractive",
    };
  }
  if (sentences.length <= 3) {
    return {
      body: sentences.join(" ").slice(0, 1600),
      sentenceCount: sentences.length,
      keyPoints: clipKeyLearningPoints(sentences, input.locale),
      vocabulary: extractLessonVocabulary({
        fullText: prepared,
        segments: input.segments,
        locale: input.locale,
      }),
      improvementAreas: extractImprovementAreas({
        fullText: prepared,
        segments: input.segments,
        locale: input.locale,
        sentences,
      }),
      nextLessonRecommendations: extractNextLessonRecommendations({
        fullText: prepared,
        segments: input.segments,
        locale: input.locale,
        sentences,
      }),
      engine: "extractive",
    };
  }
  const teacherExtra = (input.segments ?? [])
    .filter((item) => item.speakerRole === "teacher")
    .map((item) => item.body)
    .join(" ");
  const frequencies = new Map<string, number>();
  for (const token of summaryTokens(`${prepared} ${teacherExtra}`, input.locale)) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  const ranked = sentences.map((sentence, index) => {
    const tokens = summaryTokens(sentence, input.locale);
    const score = tokens.length
      ? tokens.reduce((sum, token) => sum + (frequencies.get(token) ?? 0), 0) /
        tokens.length
      : 0;
    const ends = index === 0 || index === sentences.length - 1 ? 0.15 : 0;
    return { sentence, index, score: score + ends };
  });
  const keep = Math.min(5, Math.max(3, Math.ceil(sentences.length / 4)));
  const chosen = ranked
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, keep)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence);
  return {
    body: chosen.join(" ").slice(0, 1600),
    sentenceCount: chosen.length,
    keyPoints: extractKeyLearningPoints({
      fullText: prepared,
      segments: input.segments,
      locale: input.locale,
      sentences,
    }),
    vocabulary: extractLessonVocabulary({
      fullText: prepared,
      segments: input.segments,
      locale: input.locale,
    }),
    improvementAreas: extractImprovementAreas({
      fullText: prepared,
      segments: input.segments,
      locale: input.locale,
      sentences,
    }),
    nextLessonRecommendations: extractNextLessonRecommendations({
      fullText: prepared,
      segments: input.segments,
      locale: input.locale,
      sentences,
    }),
    engine: "extractive",
  };
}

const KEY_POINT_HINTS_EN = [
  "learn",
  "remember",
  "practise",
  "practice",
  "recite",
  "read",
  "write",
  "listen",
  "repeat",
  "rule",
  "meaning",
];

const KEY_POINT_HINTS_AR = [
  "تعلم",
  "تذكّر",
  "تذكر",
  "راجع",
  "اقرأ",
  "اكتب",
  "استمع",
  "كرر",
  "قاعدة",
  "معنى",
  "احفظ",
];

function clipKeyPoint(text: string, locale: AiLocale) {
  const cleaned =
    locale === "ar" ? normaliseArabicTranscript(text) : normaliseEnglishTranscript(text);
  if (cleaned.length <= 180) return cleaned;
  const cut = cleaned.slice(0, 180);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim();
}

function clipKeyLearningPoints(sentences: string[], locale: AiLocale) {
  const seen = new Set<string>();
  const points: string[] = [];
  for (const sentence of sentences) {
    const point = clipKeyPoint(sentence, locale);
    const key = point.toLowerCase().slice(0, 40);
    if (point.length < 8 || seen.has(key)) continue;
    seen.add(key);
    points.push(point);
    if (points.length >= 6) break;
  }
  return points;
}

export function extractKeyLearningPoints(input: {
  fullText: string;
  segments?: AiTranscriptSegment[];
  locale: AiLocale;
  sentences?: string[];
}) {
  const prepared =
    input.sentences?.length
      ? ""
      : input.segments?.length
        ? input.segments.map((item) => item.body.trim()).filter(Boolean).join(" ")
        : input.fullText.replace(/^[^:\n]{1,80}:\s*/gm, " ");
  const text =
    input.sentences?.join(" ") ||
    (input.locale === "ar"
      ? normaliseArabicTranscript(prepared)
      : normaliseEnglishTranscript(prepared));
  const sentences = input.sentences ?? splitLessonSentences(text, input.locale);
  if (!sentences.length) return [] as string[];
  if (sentences.length <= 4) return clipKeyLearningPoints(sentences, input.locale);
  const teacherExtra = (input.segments ?? [])
    .filter((item) => item.speakerRole === "teacher")
    .map((item) => item.body)
    .join(" ");
  const frequencies = new Map<string, number>();
  for (const token of summaryTokens(`${text} ${teacherExtra}`, input.locale)) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  const hints = input.locale === "ar" ? KEY_POINT_HINTS_AR : KEY_POINT_HINTS_EN;
  const ranked = sentences.map((sentence, index) => {
    const tokens = summaryTokens(sentence, input.locale);
    const score = tokens.length
      ? tokens.reduce((sum, token) => sum + (frequencies.get(token) ?? 0), 0) /
        tokens.length
      : 0;
    const lower = sentence.toLowerCase();
    const hint = hints.some((word) => lower.includes(word)) ? 0.4 : 0;
    const brevity = sentence.length < 160 ? 0.2 : 0;
    return { sentence, index, score: score + hint + brevity };
  });
  const keep = Math.min(6, Math.max(3, Math.ceil(sentences.length / 5)));
  const chosen = ranked
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, keep)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence);
  return clipKeyLearningPoints(chosen, input.locale);
}

export function parseTypedKeyPoints(text: string, locale: AiLocale) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .map((line) => clipKeyPoint(line, locale))
    .filter((line) => line.length >= 8)
    .slice(0, 8);
}

export function payloadKeyPoints(payload: Record<string, unknown> | null | undefined) {
  const value = payload?.keyPoints;
  if (!Array.isArray(value)) return [] as string[];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 8);
}

const EXTRA_VOCAB_STOPWORDS_EN = new Set([
  ...ENGLISH_SUMMARY_STOPWORDS,
  "also",
  "can",
  "could",
  "did",
  "do",
  "does",
  "just",
  "like",
  "more",
  "most",
  "not",
  "now",
  "one",
  "please",
  "said",
  "should",
  "some",
  "than",
  "then",
  "very",
  "will",
  "would",
  "yes",
]);

function vocabNorm(word: string) {
  return word.toLowerCase().replace(/\u0640+/g, "");
}

function vocabSourceText(input: {
  fullText: string;
  segments?: AiTranscriptSegment[];
}) {
  return input.segments?.length
    ? input.segments.map((item) => item.body.trim()).filter(Boolean).join(" ")
    : input.fullText.replace(/^[^:\n]{1,80}:\s*/gm, " ");
}

function collectVocabTokens(text: string) {
  return text.match(/[\p{L}\p{M}]+/gu) ?? [];
}

export function extractLessonVocabulary(input: {
  fullText: string;
  segments?: AiTranscriptSegment[];
  locale: AiLocale;
}) {
  const source = vocabSourceText(input);
  const prepared =
    input.locale === "ar"
      ? normaliseArabicTranscript(source)
      : normaliseEnglishTranscript(source);
  if (!prepared.trim()) return [] as string[];
  const stop =
    input.locale === "ar" ? ARABIC_SUMMARY_STOPWORDS : EXTRA_VOCAB_STOPWORDS_EN;
  const minLength = input.locale === "ar" ? 3 : 4;
  const counts = new Map<string, { raw: string; count: number; teacher: number }>();
  function add(raw: string, teacher: boolean) {
    const key = vocabNorm(raw);
    if (key.length < minLength || stop.has(key)) return;
    const current = counts.get(key);
    if (current) {
      current.count += 1;
      if (teacher) current.teacher += 1;
    } else {
      counts.set(key, { raw, count: 1, teacher: teacher ? 1 : 0 });
    }
  }
  if (input.segments?.length) {
    for (const segment of input.segments) {
      const line =
        input.locale === "ar"
          ? normaliseArabicTranscript(segment.body)
          : normaliseEnglishTranscript(segment.body);
      const teacher = segment.speakerRole === "teacher";
      for (const token of collectVocabTokens(line)) add(token, teacher);
    }
  } else {
    for (const token of collectVocabTokens(prepared)) add(token, false);
  }
  const phrases = new Map<string, { raw: string; count: number }>();
  const content = collectVocabTokens(prepared).filter((token) => {
    const key = vocabNorm(token);
    return key.length >= minLength && !stop.has(key);
  });
  for (let index = 0; index < content.length - 1; index += 1) {
    const left = content[index];
    const right = content[index + 1];
    if (!left || !right) continue;
    const key = `${vocabNorm(left)} ${vocabNorm(right)}`;
    const raw = `${left} ${right}`;
    const current = phrases.get(key);
    if (current) current.count += 1;
    else phrases.set(key, { raw, count: 1 });
  }
  const words = [...counts.values()]
    .map((item) => ({
      raw: item.raw,
      score: item.count * (1 + Math.min(item.raw.length, 12) * 0.08) + item.teacher * 0.6,
    }))
    .sort((left, right) => right.score - left.score)
    .map((item) => item.raw);
  const phraseList = [...phrases.values()]
    .filter((item) => item.count >= 2)
    .sort((left, right) => right.count - left.count)
    .map((item) => item.raw)
    .slice(0, 4);
  const seen = new Set<string>();
  const vocabulary: string[] = [];
  for (const item of [...phraseList, ...words]) {
    const key = vocabNorm(item);
    if (seen.has(key) || item.length > 48) continue;
    seen.add(key);
    vocabulary.push(item);
    if (vocabulary.length >= 12) break;
  }
  return vocabulary;
}

export function parseTypedVocabulary(text: string, locale: AiLocale) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .map((line) =>
      locale === "ar" ? normaliseArabicTranscript(line) : normaliseEnglishTranscript(line),
    )
    .filter((line) => line.length >= 2 && line.length <= 48)
    .slice(0, 16);
}

export function payloadVocabulary(payload: Record<string, unknown> | null | undefined) {
  const value = payload?.vocabulary;
  if (!Array.isArray(value)) return [] as string[];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 16);
}

const IMPROVEMENT_HINTS_EN = [
  "again",
  "almost",
  "careful",
  "check",
  "correct",
  "difficult",
  "improve",
  "mistake",
  "need",
  "practise",
  "practice",
  "repeat",
  "review",
  "revise",
  "slow",
  "try",
  "watch",
  "work on",
];

const IMPROVEMENT_HINTS_AR = [
  "أعد",
  "انتبه",
  "بطء",
  "تحقق",
  "تدرب",
  "تمرن",
  "حاول",
  "حسّن",
  "حسن",
  "راجع",
  "كرر",
  "مرة أخرى",
  "تحتاج",
  "خطأ",
  "صعب",
  "صحح",
];

export function extractImprovementAreas(input: {
  fullText: string;
  segments?: AiTranscriptSegment[];
  locale: AiLocale;
  sentences?: string[];
}) {
  const prepared =
    input.sentences?.length
      ? ""
      : input.segments?.length
        ? input.segments.map((item) => item.body.trim()).filter(Boolean).join(" ")
        : input.fullText.replace(/^[^:\n]{1,80}:\s*/gm, " ");
  const text =
    input.sentences?.join(" ") ||
    (input.locale === "ar"
      ? normaliseArabicTranscript(prepared)
      : normaliseEnglishTranscript(prepared));
  const sentences = input.sentences ?? splitLessonSentences(text, input.locale);
  if (!sentences.length) return [] as string[];
  const hints = input.locale === "ar" ? IMPROVEMENT_HINTS_AR : IMPROVEMENT_HINTS_EN;
  const teacherText = (input.segments ?? [])
    .filter((item) => item.speakerRole === "teacher")
    .map((item) => item.body)
    .join(" ")
    .toLowerCase();
  const ranked = sentences
    .map((sentence, index) => {
      const lower = sentence.toLowerCase();
      const hintHits = hints.filter((word) => lower.includes(word)).length;
      if (!hintHits) return null;
      const teacher = teacherText && teacherText.includes(lower.slice(0, 40)) ? 0.5 : 0;
      return {
        sentence,
        index,
        score: hintHits + teacher + (sentence.length < 160 ? 0.2 : 0),
      };
    })
    .filter((item): item is { sentence: string; index: number; score: number } =>
      Boolean(item),
    )
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 6)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence);
  return clipKeyLearningPoints(ranked, input.locale).slice(0, 6);
}

export function parseTypedImprovementAreas(text: string, locale: AiLocale) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .map((line) => clipKeyPoint(line, locale))
    .filter((line) => line.length >= 8)
    .slice(0, 8);
}

export function payloadImprovementAreas(
  payload: Record<string, unknown> | null | undefined,
) {
  const value = payload?.improvementAreas;
  if (!Array.isArray(value)) return [] as string[];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 8);
}

const NEXT_LESSON_HINTS_EN = [
  "continue",
  "homework",
  "next lesson",
  "next time",
  "next week",
  "prepare",
  "tomorrow",
  "bring",
  "for next",
  "until next",
  "see you",
];

const NEXT_LESSON_HINTS_AR = [
  "الدرس القادم",
  "الحصة القادمة",
  "المرة القادمة",
  "الأسبوع القادم",
  "غدا",
  "غداً",
  "واجب",
  "حضر",
  "استعد",
  "نكمل",
  "نواصل",
  "إلى اللقاء",
];

export function extractNextLessonRecommendations(input: {
  fullText: string;
  segments?: AiTranscriptSegment[];
  locale: AiLocale;
  sentences?: string[];
}) {
  const prepared =
    input.sentences?.length
      ? ""
      : input.segments?.length
        ? input.segments.map((item) => item.body.trim()).filter(Boolean).join(" ")
        : input.fullText.replace(/^[^:\n]{1,80}:\s*/gm, " ");
  const text =
    input.sentences?.join(" ") ||
    (input.locale === "ar"
      ? normaliseArabicTranscript(prepared)
      : normaliseEnglishTranscript(prepared));
  const sentences = input.sentences ?? splitLessonSentences(text, input.locale);
  if (!sentences.length) return [] as string[];
  const hints = input.locale === "ar" ? NEXT_LESSON_HINTS_AR : NEXT_LESSON_HINTS_EN;
  const teacherText = (input.segments ?? [])
    .filter((item) => item.speakerRole === "teacher")
    .map((item) => item.body)
    .join(" ")
    .toLowerCase();
  const ranked = sentences
    .map((sentence, index) => {
      const lower = sentence.toLowerCase();
      const hintHits = hints.filter((word) => lower.includes(word)).length;
      if (!hintHits) return null;
      const teacher = teacherText && teacherText.includes(lower.slice(0, 40)) ? 0.5 : 0;
      const closing = index >= sentences.length - 3 ? 0.3 : 0;
      return {
        sentence,
        index,
        score: hintHits + teacher + closing + (sentence.length < 160 ? 0.2 : 0),
      };
    })
    .filter((item): item is { sentence: string; index: number; score: number } =>
      Boolean(item),
    )
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 6)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence);
  return clipKeyLearningPoints(ranked, input.locale).slice(0, 6);
}

export function parseTypedNextLessonRecommendations(text: string, locale: AiLocale) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .map((line) => clipKeyPoint(line, locale))
    .filter((line) => line.length >= 8)
    .slice(0, 8);
}

export function payloadNextLessonRecommendations(
  payload: Record<string, unknown> | null | undefined,
) {
  const value = payload?.nextLessonRecommendations;
  if (!Array.isArray(value)) return [] as string[];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 8);
}

export type AiRecommendationDraft = {
  title: string;
  body: string;
  items: string[];
  focus: string[];
  engine: "extractive";
};

export function extractLearningRecommendationDraft(input: {
  fullText: string;
  segments?: AiTranscriptSegment[];
  locale: AiLocale;
  title: string;
}): AiRecommendationDraft {
  const next = extractNextLessonRecommendations(input);
  const focus = extractImprovementAreas(input);
  const points = extractKeyLearningPoints(input);
  const seen = new Set<string>();
  const items: string[] = [];
  function add(line: string) {
    const cleaned = line.trim();
    const key = cleaned.toLowerCase().slice(0, 40);
    if (cleaned.length < 8 || seen.has(key) || items.length >= 8) return;
    seen.add(key);
    items.push(cleaned);
  }
  for (const line of next) add(line);
  for (const line of focus) add(line);
  if (items.length < 3) {
    for (const line of points) add(line);
  }
  return {
    title: input.title.trim().slice(0, 160),
    body: (items.join(" ") || input.fullText.replace(/\s+/g, " ").trim()).slice(0, 2400),
    items,
    focus: focus.slice(0, 6),
    engine: "extractive",
  };
}

export function parseTypedRecommendation(input: {
  title: string;
  body: string;
  items?: string;
  locale: AiLocale;
}) {
  const title = input.title.trim().slice(0, 160);
  const body =
    input.locale === "ar"
      ? normaliseArabicTranscript(input.body)
      : normaliseEnglishTranscript(input.body);
  const items = (input.items ?? body)
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .map((line) => clipKeyPoint(line, input.locale))
    .filter((line) => line.length >= 8)
    .slice(0, 8);
  return {
    title,
    body: body.slice(0, 4000),
    items,
    focus: items.slice(0, 6),
  };
}

export function payloadRecommendationTitle(
  payload: Record<string, unknown> | null | undefined,
) {
  const title = payload?.title;
  return typeof title === "string" ? title : "";
}

export function payloadRecommendationBody(
  payload: Record<string, unknown> | null | undefined,
) {
  const body = payload?.body;
  return typeof body === "string" ? body : "";
}

export function payloadRecommendationItems(
  payload: Record<string, unknown> | null | undefined,
) {
  const value = payload?.items;
  if (!Array.isArray(value)) return [] as string[];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 8);
}

export function payloadRecommendationFocus(
  payload: Record<string, unknown> | null | undefined,
) {
  const value = payload?.focus;
  if (!Array.isArray(value)) return [] as string[];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 6);
}

export function payloadRecommendationPreviousTitle(
  payload: Record<string, unknown> | null | undefined,
) {
  const value = payload?.previousTitle;
  return typeof value === "string" ? value : "";
}

export function payloadSummaryBody(payload: Record<string, unknown> | null | undefined) {
  const body = payload?.body;
  return typeof body === "string" ? body : "";
}

export function payloadSummaryTranscriptJobId(
  payload: Record<string, unknown> | null | undefined,
) {
  const value = payload?.transcriptJobId;
  return typeof value === "string" ? value : null;
}

export type AiStudentNotesDraft = {
  body: string;
  bullets: string[];
  engine: "extractive";
};

export function extractStudentNotes(input: {
  fullText: string;
  segments?: AiTranscriptSegment[];
  locale: AiLocale;
}): AiStudentNotesDraft {
  const source = input.segments?.length
    ? input.segments.map((item) => item.body.trim()).filter(Boolean).join(" ")
    : input.fullText.replace(/^[^:\n]{1,80}:\s*/gm, " ");
  const prepared =
    input.locale === "ar"
      ? normaliseArabicTranscript(source)
      : normaliseEnglishTranscript(source);
  const sentences = splitLessonSentences(prepared, input.locale);
  if (!sentences.length) return { body: "", bullets: [], engine: "extractive" };
  if (sentences.length <= 4) {
    return {
      body: sentences.join(" ").slice(0, 2400),
      bullets: clipKeyLearningPoints(sentences, input.locale),
      engine: "extractive",
    };
  }
  const teacherExtra = (input.segments ?? [])
    .filter((item) => item.speakerRole === "teacher")
    .map((item) => item.body)
    .join(" ");
  const frequencies = new Map<string, number>();
  for (const token of summaryTokens(`${prepared} ${teacherExtra}`, input.locale)) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  const ranked = sentences.map((sentence, index) => {
    const tokens = summaryTokens(sentence, input.locale);
    const score = tokens.length
      ? tokens.reduce((sum, token) => sum + (frequencies.get(token) ?? 0), 0) /
        tokens.length
      : 0;
    return { sentence, index, score };
  });
  const keep = Math.min(8, Math.max(4, Math.ceil(sentences.length / 3)));
  const chosen = ranked
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, keep)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence);
  return {
    body: chosen.join(" ").slice(0, 2400),
    bullets: clipKeyLearningPoints(chosen, input.locale),
    engine: "extractive",
  };
}

export function parseTypedNotes(text: string, locale: AiLocale) {
  const prepared =
    locale === "ar" ? normaliseArabicTranscript(text) : normaliseEnglishTranscript(text);
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .map((line) => clipKeyPoint(line, locale))
    .filter((line) => line.length >= 8)
    .slice(0, 10);
  const bullets = lines.length > 1 ? lines : [];
  return { body: prepared.slice(0, 4000), bullets };
}

export function payloadNotesBody(payload: Record<string, unknown> | null | undefined) {
  const body = payload?.body;
  return typeof body === "string" ? body : "";
}

export function payloadNotesBullets(payload: Record<string, unknown> | null | undefined) {
  const value = payload?.bullets;
  if (!Array.isArray(value)) return [] as string[];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 10);
}

const HOMEWORK_HINTS_EN = [
  "practise",
  "practice",
  "write",
  "complete",
  "homework",
  "memorise",
  "memorize",
  "read",
  "recite",
  "revise",
  "learn",
  "copy",
  "answer",
  "exercise",
  "worksheet",
  "do this",
  "for next",
];

const HOMEWORK_HINTS_AR = [
  "واجب",
  "اكتب",
  "أكمل",
  "حفظ",
  "احفظ",
  "اقرأ",
  "تلاوة",
  "راجع",
  "تمرين",
  "تدرب",
  "أجب",
  "انسخ",
  "تعلم",
];

export type AiHomeworkDraft = {
  title: string;
  body: string;
  tasks: string[];
  engine: "extractive";
};

export function extractHomeworkDraft(input: {
  fullText: string;
  segments?: AiTranscriptSegment[];
  locale: AiLocale;
  classroomTitle: string;
}): AiHomeworkDraft {
  const source = input.segments?.length
    ? input.segments.map((item) => item.body.trim()).filter(Boolean).join(" ")
    : input.fullText.replace(/^[^:\n]{1,80}:\s*/gm, " ");
  const prepared =
    input.locale === "ar"
      ? normaliseArabicTranscript(source)
      : normaliseEnglishTranscript(source);
  const sentences = splitLessonSentences(prepared, input.locale);
  const hints = input.locale === "ar" ? HOMEWORK_HINTS_AR : HOMEWORK_HINTS_EN;
  const teacherText = (input.segments ?? [])
    .filter((item) => item.speakerRole === "teacher")
    .map((item) => item.body)
    .join(" ")
    .toLowerCase();
  const hinted = sentences
    .map((sentence, index) => {
      const lower = sentence.toLowerCase();
      const hintHits = hints.filter((word) => lower.includes(word)).length;
      const question = /[?؟]/.test(sentence) ? 1 : 0;
      if (!hintHits && !question) return null;
      const teacher = teacherText && teacherText.includes(lower.slice(0, 40)) ? 0.5 : 0;
      return {
        sentence,
        index,
        score: hintHits + question + teacher + (sentence.length < 160 ? 0.2 : 0),
      };
    })
    .filter((item): item is { sentence: string; index: number; score: number } =>
      Boolean(item),
    )
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 8)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence);
  const fallback = extractKeyLearningPoints({
    fullText: input.fullText,
    segments: input.segments,
    locale: input.locale,
    sentences,
  });
  const tasks = clipKeyLearningPoints(hinted.length ? hinted : fallback, input.locale).slice(
    0,
    8,
  );
  return {
    title: input.classroomTitle.trim().slice(0, 160),
    body: (tasks.length ? tasks : sentences).join(" ").slice(0, 2400),
    tasks,
    engine: "extractive",
  };
}

export function parseTypedHomework(input: {
  title: string;
  body: string;
  tasks?: string;
  locale: AiLocale;
}) {
  const title = input.title.trim().slice(0, 160);
  const body =
    input.locale === "ar"
      ? normaliseArabicTranscript(input.body)
      : normaliseEnglishTranscript(input.body);
  const tasks = input.tasks
    ? input.tasks
        .split(/\n+/)
        .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
        .map((line) => clipKeyPoint(line, input.locale))
        .filter((line) => line.length >= 8)
        .slice(0, 8)
    : [];
  return { title, body: body.slice(0, 4000), tasks };
}

export function payloadHomeworkTitle(payload: Record<string, unknown> | null | undefined) {
  const title = payload?.title;
  return typeof title === "string" ? title : "";
}

export function payloadHomeworkBody(payload: Record<string, unknown> | null | undefined) {
  const body = payload?.body;
  return typeof body === "string" ? body : "";
}

export function payloadHomeworkTasks(payload: Record<string, unknown> | null | undefined) {
  const value = payload?.tasks;
  if (!Array.isArray(value)) return [] as string[];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 8);
}

export type AiQuizQuestionDraft = {
  kind: "written" | "short" | "true_false" | "choice";
  prompt: string;
  accepted?: string[];
  answer?: boolean;
  choices?: string[];
  choiceAnswer?: number;
  bankId?: string;
};

export type AiQuizDraft = {
  title: string;
  body: string;
  questions: AiQuizQuestionDraft[];
  engine: "extractive";
};

function asWrittenQuizPrompt(prompt: string, locale: AiLocale): AiQuizQuestionDraft | null {
  const text = clipKeyPoint(prompt, locale);
  if (text.length < 8) return null;
  return { kind: "written", prompt: text };
}

export function extractQuizDraft(input: {
  fullText: string;
  segments?: AiTranscriptSegment[];
  locale: AiLocale;
  title: string;
}): AiQuizDraft {
  const source = input.segments?.length
    ? input.segments.map((item) => item.body.trim()).filter(Boolean).join(" ")
    : input.fullText.replace(/^[^:\n]{1,80}:\s*/gm, " ");
  const prepared =
    input.locale === "ar"
      ? normaliseArabicTranscript(source)
      : normaliseEnglishTranscript(source);
  const sentences = splitLessonSentences(prepared, input.locale);
  const questions: AiQuizQuestionDraft[] = [];
  const seen = new Set<string>();
  function add(question: AiQuizQuestionDraft | null) {
    if (!question || questions.length >= 8) return;
    const key = question.prompt.toLowerCase().slice(0, 40);
    if (seen.has(key)) return;
    seen.add(key);
    questions.push(question);
  }
  for (const sentence of sentences) {
    if (/[?؟]/.test(sentence)) add(asWrittenQuizPrompt(sentence, input.locale));
  }
  if (questions.length < 4) {
    for (const point of extractKeyLearningPoints({
      fullText: input.fullText,
      segments: input.segments,
      locale: input.locale,
      sentences,
    })) {
      add(asWrittenQuizPrompt(point, input.locale));
    }
  }
  if (questions.length < 6) {
    for (const word of extractLessonVocabulary({
      fullText: input.fullText,
      segments: input.segments,
      locale: input.locale,
    })) {
      const sentence = sentences.find((item) =>
        item.toLowerCase().includes(word.toLowerCase()),
      );
      if (!sentence) continue;
      const prompt = clipKeyPoint(sentence, input.locale);
      if (prompt.length < 8) continue;
      add({ kind: "short", prompt, accepted: [word] });
    }
  }
  if (questions.length < 3) {
    for (const sentence of sentences) {
      if (/[?؟]/.test(sentence)) continue;
      const prompt = clipKeyPoint(sentence, input.locale);
      if (prompt.length < 8) continue;
      add({ kind: "true_false", prompt, answer: true });
    }
  }
  return {
    title: input.title.trim().slice(0, 160),
    body: (questions.map((item) => item.prompt).join(" ") || prepared).slice(0, 2400),
    questions,
    engine: "extractive",
  };
}

export function parseTypedQuiz(input: {
  title: string;
  body: string;
  questions?: string;
  locale: AiLocale;
}) {
  const title = input.title.trim().slice(0, 160);
  const body =
    input.locale === "ar"
      ? normaliseArabicTranscript(input.body)
      : normaliseEnglishTranscript(input.body);
  const questions = input.questions
    ? input.questions
        .split(/\n+/)
        .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
        .map((line) => asWrittenQuizPrompt(line, input.locale))
        .filter((item): item is AiQuizQuestionDraft => Boolean(item))
        .slice(0, 8)
    : [];
  return { title, body: body.slice(0, 4000), questions };
}

export function payloadQuizTitle(payload: Record<string, unknown> | null | undefined) {
  const title = payload?.title;
  return typeof title === "string" ? title : "";
}

export function payloadQuizBody(payload: Record<string, unknown> | null | undefined) {
  const body = payload?.body;
  return typeof body === "string" ? body : "";
}

export function payloadQuizSource(payload: Record<string, unknown> | null | undefined) {
  const value = payload?.source;
  return typeof value === "string" && isAiQuizSource(value) ? value : "lesson";
}

export function payloadQuizTopic(payload: Record<string, unknown> | null | undefined) {
  const topic = payload?.topic;
  return typeof topic === "string" ? topic : "";
}

export function payloadQuizMaterialId(payload: Record<string, unknown> | null | undefined) {
  const value = payload?.materialId;
  return typeof value === "string" ? value : null;
}

export function payloadQuizFileName(payload: Record<string, unknown> | null | undefined) {
  const value = payload?.fileName;
  return typeof value === "string" ? value : "";
}

export function payloadQuizPreviousTitle(
  payload: Record<string, unknown> | null | undefined,
) {
  const value = payload?.previousTitle;
  return typeof value === "string" ? value : "";
}

export function payloadQuizQuestions(
  payload: Record<string, unknown> | null | undefined,
): AiQuizQuestionDraft[] {
  const value = payload?.questions;
  if (!Array.isArray(value)) return [];
  const questions: AiQuizQuestionDraft[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
    if (prompt.length < 8) continue;
    const kind = row.kind;
    if (kind === "short") {
      const accepted = Array.isArray(row.accepted)
        ? row.accepted.filter((word): word is string => typeof word === "string" && word.trim().length > 0)
            .map((word) => word.trim())
            .slice(0, 6)
        : [];
      questions.push({
        kind: "short",
        prompt,
        accepted,
        bankId: typeof row.bankId === "string" ? row.bankId : undefined,
      });
    } else if (kind === "true_false") {
      questions.push({
        kind: "true_false",
        prompt,
        answer: row.answer === false ? false : true,
        bankId: typeof row.bankId === "string" ? row.bankId : undefined,
      });
    } else if (kind === "choice") {
      const choices = Array.isArray(row.choices)
        ? row.choices
            .filter((choice): choice is string => typeof choice === "string")
            .map((choice) => choice.trim())
            .filter(Boolean)
            .slice(0, 6)
        : [];
      const choiceAnswer =
        typeof row.choiceAnswer === "number" && Number.isInteger(row.choiceAnswer)
          ? row.choiceAnswer
          : 0;
      questions.push({
        kind: "choice",
        prompt,
        choices,
        choiceAnswer: Math.max(0, Math.min(choiceAnswer, Math.max(choices.length - 1, 0))),
        bankId: typeof row.bankId === "string" ? row.bankId : undefined,
      });
    } else {
      questions.push({
        kind: "written",
        prompt,
        bankId: typeof row.bankId === "string" ? row.bankId : undefined,
      });
    }
    if (questions.length >= 8) break;
  }
  return questions;
}

export function hideQuizAnswers(questions: AiQuizQuestionDraft[]): AiQuizQuestionDraft[] {
  return questions.map((item) => {
    if (item.kind === "choice") {
      return { kind: "choice", prompt: item.prompt, choices: item.choices };
    }
    if (item.kind === "true_false") return { kind: "true_false", prompt: item.prompt };
    if (item.kind === "short") return { kind: "short", prompt: item.prompt };
    return { kind: "written", prompt: item.prompt };
  });
}
