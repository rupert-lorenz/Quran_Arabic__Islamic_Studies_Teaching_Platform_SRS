export type TeacherReliability = {
  label: string;
  indicators: string[];
  score: number;
};

export type TeacherStats = {
  averageRating: number | null;
  reviewCount: number;
  recommendPercent: number | null;
  ratingLabel: string;
  lessonsTaught: number;
  responseRate: number | null;
  reliability: TeacherReliability;
};

export function formatTeacherRating(
  averageRating: number | null,
  reviewCount: number,
) {
  if (!reviewCount || averageRating == null) {
    return "New";
  }
  return averageRating.toFixed(1);
}

export function teacherReliability(input: {
  averageRating: number | null;
  reviewCount: number;
  responseRate: number | null;
  lessonsTaught: number;
  recommendPercent?: number | null;
}): TeacherReliability {
  const indicators: string[] = [];
  let score = 0;
  let label = "New";

  if (input.reviewCount >= 8 && (input.averageRating ?? 0) >= 4.5) {
    label = "Highly rated";
    score += 40;
  } else if (input.reviewCount >= 3 && (input.averageRating ?? 0) >= 4) {
    label = "Reliable";
    score += 25;
  } else if (input.reviewCount >= 3 && (input.averageRating ?? 0) < 3.5) {
    label = "Mixed reviews";
    score += 5;
  } else if (input.reviewCount > 0) {
    label = "Building reputation";
    score += 10;
  }

  if (input.responseRate != null && input.responseRate >= 90) {
    indicators.push("Responsive");
    score += 20;
  } else if (input.responseRate != null && input.responseRate >= 70) {
    indicators.push("Usually responds");
    score += 10;
  }

  if (input.lessonsTaught >= 50) {
    indicators.push("Experienced");
    score += 20;
  } else if (input.lessonsTaught >= 10) {
    indicators.push("Active teacher");
    score += 10;
  }

  if (input.recommendPercent != null && input.recommendPercent >= 90 && input.reviewCount >= 3) {
    indicators.push("Would book again");
    score += 10;
  }

  return {
    label,
    indicators,
    score: Math.min(100, score),
  };
}

export function buildTeacherStats(input: {
  averageRating: number | null;
  reviewCount: number;
  recommendPercent?: number | null;
  lessonsTaught: number;
  responseRate: number | null;
}): TeacherStats {
  return {
    averageRating: input.averageRating,
    reviewCount: input.reviewCount,
    recommendPercent: input.recommendPercent ?? null,
    ratingLabel: formatTeacherRating(input.averageRating, input.reviewCount),
    lessonsTaught: input.lessonsTaught,
    responseRate: input.responseRate,
    reliability: teacherReliability(input),
  };
}
