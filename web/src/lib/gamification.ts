export const REWARD_KINDS = [
  "quiz",
  "exam",
  "homework",
  "game",
  "course",
  "certificate",
  "lesson",
] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

export const REWARD_POINTS: Record<RewardKind, number> = {
  game: 5,
  homework: 10,
  lesson: 10,
  quiz: 15,
  certificate: 20,
  exam: 25,
  course: 8,
};

export const REWARD_STARS: Record<RewardKind, number> = {
  game: 1,
  course: 1,
  homework: 1,
  lesson: 1,
  quiz: 2,
  certificate: 2,
  exam: 3,
};

export const REWARD_LEVEL_KEYS = [
  "seed",
  "sprout",
  "leaf",
  "branch",
  "tree",
  "grove",
] as const;
export type RewardLevelKey = (typeof REWARD_LEVEL_KEYS)[number];

export const REWARD_BADGE_KEYS = [
  "first_game",
  "first_quiz",
  "first_exam",
  "first_homework",
  "first_course",
  "first_certificate",
  "first_lesson",
  "streak_3",
  "streak_7",
  "points_50",
  "points_100",
  "points_250",
  "points_500",
  "stars_5",
  "stars_15",
  "stars_30",
] as const;
export type RewardBadgeKey = (typeof REWARD_BADGE_KEYS)[number];

export const REWARD_POINTS_PER_LEVEL = 100;

export function isRewardKind(value: string): value is RewardKind {
  return (REWARD_KINDS as readonly string[]).includes(value);
}

export function rewardLevel(points: number) {
  const safe = Math.max(0, Math.round(points));
  const level = Math.floor(safe / REWARD_POINTS_PER_LEVEL) + 1;
  const titleKey =
    REWARD_LEVEL_KEYS[Math.min(level, REWARD_LEVEL_KEYS.length) - 1] ?? "grove";
  const intoLevel = safe % REWARD_POINTS_PER_LEVEL;
  return {
    points: safe,
    level,
    titleKey,
    intoLevel,
    nextLevelAt: level * REWARD_POINTS_PER_LEVEL,
  };
}

export function rewardStarsFor(kind: RewardKind) {
  return REWARD_STARS[kind];
}

export function achievementLevels(points: number) {
  const current = rewardLevel(points);
  return REWARD_LEVEL_KEYS.map((key, index) => ({
    key,
    number: index + 1,
    minPoints: index * REWARD_POINTS_PER_LEVEL,
    reached: current.points >= index * REWARD_POINTS_PER_LEVEL,
    current:
      current.level === index + 1 ||
      (current.level > REWARD_LEVEL_KEYS.length && key === "grove"),
  }));
}

export function rewardLongestStreak(isoDates: string[]) {
  const unique = [
    ...new Set(
      isoDates
        .map((value) => value.slice(0, 10))
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
    ),
  ].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of unique) {
    if (
      previous &&
      day === utcDateKey(addUtcDays(new Date(`${previous}T00:00:00.000Z`), 1))
    ) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    previous = day;
  }
  return best;
}

export function rewardStreak(isoDates: string[], today = new Date()) {
  const unique = [
    ...new Set(
      isoDates
        .map((value) => value.slice(0, 10))
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
    ),
  ].sort((left, right) => (left < right ? 1 : left > right ? -1 : 0));
  if (!unique.length) return 0;
  const latest = unique[0];
  const todayKey = utcDateKey(today);
  const yesterdayKey = utcDateKey(addUtcDays(today, -1));
  if (latest !== todayKey && latest !== yesterdayKey) return 0;
  let streak = 0;
  let cursor = latest;
  for (const day of unique) {
    if (day !== cursor) break;
    streak += 1;
    cursor = utcDateKey(addUtcDays(new Date(`${cursor}T00:00:00.000Z`), -1));
  }
  return streak;
}

export function rewardsHref(
  roleKey: string,
  isStaff: boolean,
  studentUserId?: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/rewards"
      : roleKey === "parent"
        ? "/family/rewards"
        : roleKey === "teacher"
          ? "/teach/rewards"
          : isStaff
            ? "/staff/academic/rewards"
            : "/learn/rewards";
  if (!studentUserId || roleKey === "student") return base;
  return `${base}?student=${studentUserId}`;
}

export function familyChildRewardsHref(studentUserId: string) {
  return `/family/children/${studentUserId}/rewards`;
}

function utcDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
