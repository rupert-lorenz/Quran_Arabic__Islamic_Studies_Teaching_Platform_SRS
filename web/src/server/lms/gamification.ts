import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  examSittings,
  exams,
  gamificationEvents,
  lessonHistory,
  parentChildren,
  prerecordedCourseProgress,
  prerecordedCourses,
  quizAttempts,
  quizzes,
  users,
} from "@/db/schema";
import {
  achievementLevels,
  familyChildRewardsHref,
  isRewardKind,
  REWARD_BADGE_KEYS,
  REWARD_POINTS,
  rewardLevel,
  rewardLongestStreak,
  rewardsHref,
  rewardStarsFor,
  rewardStreak,
  type RewardBadgeKey,
  type RewardKind,
  type RewardLevelKey,
} from "@/lib/gamification";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { assertParentOwnsChild } from "@/server/parent/children";

export type RewardEventView = {
  id: string;
  kind: RewardKind;
  title: string;
  points: number;
  stars: number;
  at: string;
};

export type RewardBadgeView = {
  key: RewardBadgeKey;
  earned: boolean;
};

export type RewardLevelView = {
  key: RewardLevelKey;
  number: number;
  minPoints: number;
  reached: boolean;
  current: boolean;
};

export type RewardLearner = {
  studentUserId: string;
  name: string;
  href: string;
  points: number;
  stars: number;
  level: number;
  titleKey: string;
};

export type RewardProfile = {
  studentUserId: string;
  studentName: string;
  href: string;
  points: number;
  stars: number;
  level: number;
  titleKey: string;
  intoLevel: number;
  nextLevelAt: number;
  streak: number;
  longestStreak: number;
  levels: RewardLevelView[];
  events: RewardEventView[];
  badges: RewardBadgeView[];
};

export type RewardDesk = {
  href: string;
  learners: RewardLearner[];
  profile: RewardProfile | null;
  board: RewardLearner[];
};

function isStaffAcademic(actor: ApiActor) {
  return hasAnyPermission(actor, [
    "academic.curriculum",
    "academic.certificates",
    "reports.academic",
  ]);
}

function rewardsPath(actor: ApiActor, studentUserId?: string) {
  return rewardsHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffAcademic(actor),
    studentUserId,
  );
}

async function namesFor(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((row) => [row.id, row.name ?? "Student"]));
}

async function listTeacherLearnerIds(teacherUserId: string) {
  const [quizRows, examRows, courseRows, lessonRows] = await Promise.all([
    db
      .selectDistinct({ id: quizAttempts.studentUserId })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
      .where(eq(quizzes.createdByUserId, teacherUserId)),
    db
      .selectDistinct({ id: examSittings.studentUserId })
      .from(examSittings)
      .innerJoin(exams, eq(exams.id, examSittings.examId))
      .where(eq(exams.createdByUserId, teacherUserId)),
    db
      .selectDistinct({ id: prerecordedCourseProgress.studentUserId })
      .from(prerecordedCourseProgress)
      .innerJoin(
        prerecordedCourses,
        eq(prerecordedCourses.id, prerecordedCourseProgress.courseId),
      )
      .where(eq(prerecordedCourses.createdByUserId, teacherUserId)),
    db
      .selectDistinct({ id: lessonHistory.studentUserId })
      .from(lessonHistory)
      .where(eq(lessonHistory.teacherUserId, teacherUserId)),
  ]);
  return new Set(
    [...quizRows, ...examRows, ...courseRows, ...lessonRows].map((row) => row.id),
  );
}

async function listLearnerIds(actor: ApiActor) {
  if (actor.roleKey === "student") return [actor.userId];
  if (actor.roleKey === "parent") {
    const children = await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(eq(parentChildren.parentUserId, actor.userId));
    return children.map((child) => child.id);
  }
  if (actor.roleKey === "teacher" && !isStaffAcademic(actor)) {
    return [...(await listTeacherLearnerIds(actor.userId))].slice(0, 60);
  }
  if (isStaffAcademic(actor)) {
    const rows = await db
      .select({ id: gamificationEvents.studentUserId })
      .from(gamificationEvents)
      .groupBy(gamificationEvents.studentUserId)
      .orderBy(desc(sql`max(${gamificationEvents.createdAt})`))
      .limit(60);
    if (rows.length) return rows.map((row) => row.id);
    const recent = await db
      .select({ id: quizAttempts.studentUserId })
      .from(quizAttempts)
      .groupBy(quizAttempts.studentUserId)
      .orderBy(desc(sql`max(${quizAttempts.submittedAt})`))
      .limit(40);
    return [...new Set(recent.map((row) => row.id))];
  }
  return [];
}

async function assertCanViewStudent(actor: ApiActor, studentUserId: string) {
  if (actor.roleKey === "student" && actor.userId === studentUserId) return;
  if (actor.roleKey === "parent") {
    await assertParentOwnsChild(actor.userId, studentUserId);
    return;
  }
  if (isStaffAcademic(actor)) return;
  if (actor.roleKey === "teacher") {
    const known = await listTeacherLearnerIds(actor.userId);
    if (known.has(studentUserId)) return;
    throw new ApiError(403, "FORBIDDEN", "You cannot view these rewards");
  }
  throw new ApiError(403, "FORBIDDEN", "You cannot view these rewards");
}

function badgesFor(
  points: number,
  stars: number,
  streak: number,
  kinds: Set<string>,
) {
  const earned = new Set<RewardBadgeKey>();
  if (kinds.has("game")) earned.add("first_game");
  if (kinds.has("quiz")) earned.add("first_quiz");
  if (kinds.has("exam")) earned.add("first_exam");
  if (kinds.has("homework")) earned.add("first_homework");
  if (kinds.has("course")) earned.add("first_course");
  if (kinds.has("certificate")) earned.add("first_certificate");
  if (kinds.has("lesson")) earned.add("first_lesson");
  if (streak >= 3) earned.add("streak_3");
  if (streak >= 7) earned.add("streak_7");
  if (points >= 50) earned.add("points_50");
  if (points >= 100) earned.add("points_100");
  if (points >= 250) earned.add("points_250");
  if (points >= 500) earned.add("points_500");
  if (stars >= 5) earned.add("stars_5");
  if (stars >= 15) earned.add("stars_15");
  if (stars >= 30) earned.add("stars_30");
  return REWARD_BADGE_KEYS.map((key) => ({
    key,
    earned: earned.has(key),
  }));
}

async function loadEvents(studentUserIds: string[]) {
  if (!studentUserIds.length) return [];
  return db
    .select()
    .from(gamificationEvents)
    .where(inArray(gamificationEvents.studentUserId, studentUserIds))
    .orderBy(desc(gamificationEvents.createdAt));
}

function profileFromEvents(
  actor: ApiActor,
  studentUserId: string,
  studentName: string,
  events: (typeof gamificationEvents.$inferSelect)[],
): RewardProfile {
  const mine = events.filter((row) => row.studentUserId === studentUserId);
  const points = mine.reduce((sum, row) => sum + row.points, 0);
  const stars = mine.reduce((sum, row) => sum + (row.stars ?? rewardStarsFor(
    isRewardKind(row.kind) ? row.kind : "lesson",
  )), 0);
  const level = rewardLevel(points);
  const dates = mine.map((row) => row.createdAt.toISOString());
  const streak = rewardStreak(dates);
  const longestStreak = rewardLongestStreak(dates);
  const kinds = new Set(mine.map((row) => row.kind));
  return {
    studentUserId,
    studentName,
    href: rewardsPath(actor, studentUserId),
    points: level.points,
    stars,
    level: level.level,
    titleKey: level.titleKey,
    intoLevel: level.intoLevel,
    nextLevelAt: level.nextLevelAt,
    streak,
    longestStreak,
    levels: achievementLevels(level.points),
    events: mine.slice(0, 12).map((row) => ({
      id: row.id,
      kind: isRewardKind(row.kind) ? row.kind : "lesson",
      title: row.title ?? "Reward",
      points: row.points,
      stars:
        row.stars ??
        rewardStarsFor(isRewardKind(row.kind) ? row.kind : "lesson"),
      at: row.createdAt.toISOString(),
    })),
    badges: badgesFor(level.points, stars, Math.max(streak, longestStreak), kinds),
  };
}

export async function getRewardDesk(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<RewardDesk> {
  const ids = await listLearnerIds(actor);
  const requested = options?.studentUserId;
  if (requested) await assertCanViewStudent(actor, requested);
  const selected =
    requested && ids.includes(requested)
      ? requested
      : actor.roleKey === "student"
        ? actor.userId
        : ids.length === 1
          ? ids[0]
          : requested && isStaffAcademic(actor)
            ? requested
            : undefined;
  if (selected && !ids.includes(selected)) ids.unshift(selected);
  const uniqueIds = [...new Set(ids)];
  const [names, events] = await Promise.all([
    namesFor(uniqueIds),
    loadEvents(uniqueIds),
  ]);
  const learners = uniqueIds
    .map((id) => {
      const profile = profileFromEvents(
        actor,
        id,
        names.get(id) ?? "Student",
        events,
      );
      return {
        studentUserId: id,
        name: profile.studentName,
        href:
          actor.roleKey === "parent"
            ? familyChildRewardsHref(id)
            : rewardsPath(actor, id),
        points: profile.points,
        stars: profile.stars,
        level: profile.level,
        titleKey: profile.titleKey,
      };
    })
    .sort((left, right) => right.points - left.points || left.name.localeCompare(right.name));
  const profile = selected
    ? profileFromEvents(
        actor,
        selected,
        names.get(selected) ?? "Student",
        events,
      )
    : null;
  return {
    href: rewardsPath(actor, selected),
    learners,
    profile,
    board: actor.roleKey === "student" ? [] : learners.slice(0, 12),
  };
}

export async function awardGamification(input: {
  kind: RewardKind;
  studentUserId: string;
  sourceId: string;
  title: string;
}) {
  await db
    .insert(gamificationEvents)
    .values({
      studentUserId: input.studentUserId,
      kind: input.kind,
      sourceId: input.sourceId,
      title: input.title.slice(0, 160),
      points: REWARD_POINTS[input.kind],
      stars: rewardStarsFor(input.kind),
    })
    .onConflictDoNothing({
      target: [
        gamificationEvents.studentUserId,
        gamificationEvents.kind,
        gamificationEvents.sourceId,
      ],
    });
}

export async function safeAwardGamification(input: {
  kind: RewardKind;
  studentUserId: string;
  sourceId: string;
  title: string;
}) {
  try {
    await awardGamification(input);
  } catch {
    // Rewards must never fail a sit, mark, play, or progress save.
  }
}
