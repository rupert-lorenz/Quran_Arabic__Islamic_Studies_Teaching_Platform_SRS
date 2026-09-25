import { teacherReliability } from "@/lib/teacher-reputation";
import type { TeacherSearchQuery } from "@/lib/teacher-search";

export const teacherSearchSorts = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "reliability", label: "Most reliable" },
  { value: "lessons", label: "Most lessons" },
  { value: "response", label: "Fastest response" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export type TeacherSearchSort = (typeof teacherSearchSorts)[number]["value"];

export type RankableTeacher = {
  displayName: string;
  headline?: string | null;
  languages?: string | null;
  subjects: { slug: string; name: string }[];
  rating: number | null;
  reviewCount: number;
  lessonsTaught: number;
  responseRate: number | null;
  recommendPercent?: number | null;
  hasVideo: boolean;
  rateAmount: number | null;
};

export type TeacherRecommendation = {
  score: number;
  reasons: string[];
  featured: boolean;
};

const sortValues = new Set<string>(teacherSearchSorts.map((item) => item.value));

export function normalizeTeacherSort(value?: string | null): TeacherSearchSort {
  const sort = value?.trim() || "recommended";
  return sortValues.has(sort) ? (sort as TeacherSearchSort) : "recommended";
}

export function teacherSortLabel(value?: string | null) {
  const sort = normalizeTeacherSort(value);
  return teacherSearchSorts.find((item) => item.value === sort)?.label ?? "Recommended";
}

export function teacherSortDescription(value?: string | null) {
  switch (normalizeTeacherSort(value)) {
    case "rating":
      return "Highest published family ratings first.";
    case "reliability":
      return "Reputation, response rate, and lesson history first.";
    case "lessons":
      return "Teachers with the most completed lessons first.";
    case "response":
      return "Teachers who reply fastest first.";
    case "price_asc":
      return "Lowest listed hourly price first.";
    case "price_desc":
      return "Highest listed hourly price first.";
    default:
      return "Recommended first: reputation, a complete profile, and how well they match this search.";
  }
}

export function teacherSearchHref(
  query: TeacherSearchQuery,
  overrides: Partial<TeacherSearchQuery> = {},
) {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    const trimmed = value?.trim() ?? "";
    if (!trimmed || (key === "sort" && trimmed === "recommended")) {
      continue;
    }
    params.set(key, trimmed);
  }
  const search = params.toString();
  return search ? `/teachers?${search}` : "/teachers";
}

export function recommendTeacher(
  teacher: RankableTeacher,
  query: TeacherSearchQuery = {},
): Omit<TeacherRecommendation, "featured"> {
  const reliability = teacherReliability({
    averageRating: teacher.rating,
    reviewCount: teacher.reviewCount,
    responseRate: teacher.responseRate,
    lessonsTaught: teacher.lessonsTaught,
    recommendPercent: teacher.recommendPercent,
  });
  const reasons: string[] = [];
  let score = reliability.score;

  if (reliability.label !== "New") {
    reasons.push(reliability.label);
  }
  reasons.push(...reliability.indicators);

  if (teacher.hasVideo) {
    score += 12;
    reasons.push("Introduction video");
  }
  if (teacher.rateAmount != null && teacher.rateAmount > 0) {
    score += 8;
    reasons.push("Listed hourly rate");
  }

  const relevance = queryRelevance(teacher, query);
  if (relevance.points > 0) {
    score += relevance.points;
    reasons.unshift(relevance.reason);
  }

  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 3),
  };
}

export function compareRankableTeachers(
  left: RankableTeacher,
  right: RankableTeacher,
  sort?: string | null,
  query: TeacherSearchQuery = {},
) {
  const key = normalizeTeacherSort(sort);
  if (key === "price_asc") {
    return (left.rateAmount ?? Number.POSITIVE_INFINITY) -
      (right.rateAmount ?? Number.POSITIVE_INFINITY);
  }
  if (key === "price_desc") {
    return (right.rateAmount ?? -1) - (left.rateAmount ?? -1);
  }
  if (key === "lessons") {
    return right.lessonsTaught - left.lessonsTaught;
  }
  if (key === "rating") {
    return (right.rating ?? -1) - (left.rating ?? -1) ||
      right.reviewCount - left.reviewCount;
  }
  if (key === "response") {
    return (right.responseRate ?? -1) - (left.responseRate ?? -1) ||
      right.lessonsTaught - left.lessonsTaught;
  }
  if (key === "reliability") {
    return reliabilityScore(right) - reliabilityScore(left) ||
      right.reviewCount - left.reviewCount ||
      right.lessonsTaught - left.lessonsTaught;
  }

  return recommendTeacher(right, query).score - recommendTeacher(left, query).score ||
    right.lessonsTaught - left.lessonsTaught ||
    left.displayName.localeCompare(right.displayName);
}

export function sortTeachers<T>(
  teachers: T[],
  toRankable: (teacher: T) => RankableTeacher,
  sort?: string | null,
  query: TeacherSearchQuery = {},
) {
  return [...teachers].sort((left, right) =>
    compareRankableTeachers(toRankable(left), toRankable(right), sort, query),
  );
}

function reliabilityScore(teacher: RankableTeacher) {
  return teacherReliability({
    averageRating: teacher.rating,
    reviewCount: teacher.reviewCount,
    responseRate: teacher.responseRate,
    lessonsTaught: teacher.lessonsTaught,
    recommendPercent: teacher.recommendPercent,
  }).score;
}

function queryRelevance(teacher: RankableTeacher, query: TeacherSearchQuery) {
  const q = query.q?.trim().toLowerCase() ?? "";
  if (!q) {
    return { points: 0, reason: "" };
  }
  if (teacher.displayName.toLowerCase().includes(q)) {
    return { points: 25, reason: "Matches this search" };
  }
  if (
    teacher.subjects.some(
      (item) =>
        item.name.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q),
    )
  ) {
    return { points: 16, reason: "Matches this subject" };
  }
  if ((teacher.headline ?? "").toLowerCase().includes(q)) {
    return { points: 12, reason: "Matches this search" };
  }
  if ((teacher.languages ?? "").toLowerCase().includes(q)) {
    return { points: 10, reason: "Matches this language" };
  }
  return { points: 0, reason: "" };
}
