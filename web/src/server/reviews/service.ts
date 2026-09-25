import { and, avg, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  parentProfiles,
  teacherProfiles,
  teacherReviews,
  users,
} from "@/db/schema";
import { buildTeacherStats } from "@/lib/teacher-reputation";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import type {
  ModerateTeacherReviewInput,
  SubmitTeacherReviewInput,
  UpdateTeacherStatsInput,
} from "./schemas";

export function emptyReviewAggregate() {
  return {
    averageRating: null as number | null,
    reviewCount: 0,
    recommendPercent: null as number | null,
  };
}

export async function getTeacherReviewAggregates(teacherUserIds: string[]) {
  const map = new Map<string, ReturnType<typeof emptyReviewAggregate>>();
  for (const userId of teacherUserIds) {
    map.set(userId, emptyReviewAggregate());
  }
  if (teacherUserIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({
      teacherUserId: teacherReviews.teacherUserId,
      averageRating: avg(teacherReviews.rating),
      reviewCount: count(),
      recommendCount: sql<number>`sum(case when ${teacherReviews.recommend} then 1 else 0 end)`,
    })
    .from(teacherReviews)
    .where(
      and(
        inArray(teacherReviews.teacherUserId, teacherUserIds),
        eq(teacherReviews.status, "published"),
      ),
    )
    .groupBy(teacherReviews.teacherUserId);

  for (const row of rows) {
    const reviewCount = Number(row.reviewCount);
    const recommendCount = Number(row.recommendCount);
    map.set(row.teacherUserId, {
      averageRating: row.averageRating ? Number(row.averageRating) : null,
      reviewCount,
      recommendPercent:
        reviewCount > 0 ? Math.round((recommendCount / reviewCount) * 100) : null,
    });
  }
  return map;
}

export function attachTeacherStats<
  T extends {
    userId: string;
    lessonsTaught: number;
    responseRate?: number | null;
  },
>(
  teachers: T[],
  aggregates: Map<string, ReturnType<typeof emptyReviewAggregate>>,
) {
  return teachers.map((teacher) => {
    const aggregate = aggregates.get(teacher.userId) ?? emptyReviewAggregate();
    return {
      ...teacher,
      stats: buildTeacherStats({
        ...aggregate,
        lessonsTaught: teacher.lessonsTaught,
        responseRate: teacher.responseRate ?? null,
      }),
    };
  });
}

export async function listPublishedTeacherReviews(teacherUserId: string) {
  const rows = await db
    .select({
      id: teacherReviews.id,
      rating: teacherReviews.rating,
      body: teacherReviews.body,
      recommend: teacherReviews.recommend,
      createdAt: teacherReviews.createdAt,
      displayName: users.displayName,
    })
    .from(teacherReviews)
    .innerJoin(users, eq(teacherReviews.parentUserId, users.id))
    .where(
      and(
        eq(teacherReviews.teacherUserId, teacherUserId),
        eq(teacherReviews.status, "published"),
      ),
    )
    .orderBy(desc(teacherReviews.createdAt));

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    body: row.body,
    recommend: row.recommend,
    createdAt: row.createdAt,
    author: maskReviewerName(row.displayName),
  }));
}

export async function getOwnTeacherReview(
  parentUserId: string,
  teacherUserId: string,
) {
  const [row] = await db
    .select()
    .from(teacherReviews)
    .where(
      and(
        eq(teacherReviews.parentUserId, parentUserId),
        eq(teacherReviews.teacherUserId, teacherUserId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function submitTeacherReview(
  actor: ApiActor,
  input: SubmitTeacherReviewInput,
  ip: string,
) {
  if (actor.roleKey !== "parent") {
    throw new ApiError(403, "FORBIDDEN", "Only parents can review teachers");
  }
  if (actor.status !== "active") {
    throw new ApiError(403, "FORBIDDEN", "Your account cannot submit a review yet");
  }

  const [parent] = await db
    .select({ userId: parentProfiles.userId })
    .from(parentProfiles)
    .where(eq(parentProfiles.userId, actor.userId))
    .limit(1);
  if (!parent) {
    throw new ApiError(403, "FORBIDDEN", "Only parents can review teachers");
  }

  const [teacher] = await db
    .select({
      userId: teacherProfiles.userId,
      verificationStatus: teacherProfiles.verificationStatus,
      status: users.status,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(eq(teacherProfiles.userId, input.teacherUserId))
    .limit(1);

  if (
    !teacher ||
    teacher.verificationStatus !== "approved" ||
    teacher.status !== "active"
  ) {
    throw new ApiError(404, "NOT_FOUND", "Teacher not found");
  }

  const [saved] = await db
    .insert(teacherReviews)
    .values({
      teacherUserId: input.teacherUserId,
      parentUserId: actor.userId,
      rating: input.rating,
      body: input.body,
      recommend: input.recommend,
      status: "pending",
    })
    .onConflictDoUpdate({
      target: [teacherReviews.teacherUserId, teacherReviews.parentUserId],
      set: {
        rating: input.rating,
        body: input.body,
        recommend: input.recommend,
        status: "pending",
        moderatedByUserId: null,
        moderatedAt: null,
        moderationNote: null,
      },
    })
    .returning();

  await writeAuditLog({
    actor,
    action: "reviews.submitted",
    entityType: "teacher_review",
    entityId: saved?.id,
    ipAddress: ip,
    metadata: { teacherUserId: input.teacherUserId, rating: input.rating },
  });

  return {
    review: saved,
    message: "Review submitted. Staff will publish it after a short check.",
  };
}

export async function listStaffTeacherReviews(status?: string) {
  const rows = await db
    .select({
      id: teacherReviews.id,
      teacherUserId: teacherReviews.teacherUserId,
      parentUserId: teacherReviews.parentUserId,
      rating: teacherReviews.rating,
      body: teacherReviews.body,
      recommend: teacherReviews.recommend,
      status: teacherReviews.status,
      moderationNote: teacherReviews.moderationNote,
      createdAt: teacherReviews.createdAt,
    })
    .from(teacherReviews)
    .where(
      status && status !== "all"
        ? eq(teacherReviews.status, status as "pending" | "published" | "hidden")
        : undefined,
    )
    .orderBy(desc(teacherReviews.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const userIds = [
    ...new Set(rows.flatMap((row) => [row.teacherUserId, row.parentUserId])),
  ];
  const people = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
    })
    .from(users)
    .where(inArray(users.id, userIds));
  const byId = new Map(people.map((person) => [person.id, person]));

  return rows.map((row) => ({
    ...row,
    teacherName: byId.get(row.teacherUserId)?.displayName ?? "Teacher",
    parentName: byId.get(row.parentUserId)?.displayName ?? "Parent",
    parentEmail: byId.get(row.parentUserId)?.email ?? "",
  }));
}

export async function moderateTeacherReview(
  actor: ApiActor,
  reviewId: string,
  input: ModerateTeacherReviewInput,
  ip: string,
) {
  const [current] = await db
    .select({ id: teacherReviews.id })
    .from(teacherReviews)
    .where(eq(teacherReviews.id, reviewId))
    .limit(1);
  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Review not found");
  }

  await db
    .update(teacherReviews)
    .set({
      status: input.status,
      moderationNote: input.note?.trim() || null,
      moderatedByUserId: actor.userId,
      moderatedAt: new Date(),
    })
    .where(eq(teacherReviews.id, reviewId));

  await writeAuditLog({
    actor,
    action: `reviews.${input.status}`,
    entityType: "teacher_review",
    entityId: reviewId,
    ipAddress: ip,
    metadata: { note: input.note },
  });

  const queue = await listStaffTeacherReviews();
  return queue.find((item) => item.id === reviewId) ?? {
    id: reviewId,
    status: input.status,
  };
}

export async function updateTeacherMarketplaceStats(
  actor: ApiActor,
  teacherUserId: string,
  input: UpdateTeacherStatsInput,
  ip: string,
) {
  if (input.responseRate == null && input.lessonsTaught == null) {
    throw new ApiError(422, "VALIDATION", "Add a response rate or lesson count");
  }

  const [current] = await db
    .select({
      userId: teacherProfiles.userId,
      lessonsTaught: teacherProfiles.lessonsTaught,
      responseRate: teacherProfiles.responseRate,
    })
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, teacherUserId))
    .limit(1);
  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Teacher not found");
  }

  const next = {
    lessonsTaught: input.lessonsTaught ?? current.lessonsTaught,
    responseRate: input.responseRate ?? current.responseRate,
  };

  await db
    .update(teacherProfiles)
    .set(next)
    .where(eq(teacherProfiles.userId, teacherUserId));

  await writeAuditLog({
    actor,
    action: "teachers.stats_updated",
    entityType: "teacher_profile",
    entityId: teacherUserId,
    ipAddress: ip,
    metadata: { ...input },
  });

  return { teacherUserId, ...next };
}

function maskReviewerName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return `${parts[0]!.slice(0, 1)}.`;
  }
  return `${parts[0]} ${parts[1]!.slice(0, 1)}.`;
}
