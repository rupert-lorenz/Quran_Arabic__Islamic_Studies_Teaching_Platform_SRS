import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  educationalGamePlays,
  educationalGames,
  parentChildren,
  subjects,
  users,
} from "@/db/schema";
import {
  emptyGamePayload,
  gamePayloadIsPlayable,
  gamesHref,
  parseGamePayload,
  scoreGamePlay,
  toGamePlayView,
  type EducationalGameKind,
  type EducationalGamePair,
  type EducationalGamePayload,
  type EducationalGamePlayView,
  type EducationalGameStatus,
} from "@/lib/games";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { safeAwardGamification } from "@/server/lms/gamification";
import { getTeacherVerificationStatus } from "@/server/teacher/onboarding";

export type EducationalGamePlayRecord = {
  studentUserId: string;
  studentName: string;
  score: number;
  total: number;
  completedAt: string;
};

export type EducationalGameView = {
  id: string;
  title: string;
  instructions: string | null;
  subjectSlug: string | null;
  subjectName: string | null;
  kind: EducationalGameKind;
  status: EducationalGameStatus;
  teacherName: string;
  href: string;
  canManage: boolean;
  canPlay: boolean;
  canRecord: boolean;
  playCount: number;
  payload: EducationalGamePayload | null;
  play: EducationalGamePlayView | null;
  lastPlay: EducationalGamePlayRecord | null;
  plays: EducationalGamePlayRecord[];
  learners: Array<{ studentUserId: string; name: string }>;
};

export type EducationalGameDesk = {
  subjects: Array<{ slug: string; name: string }>;
  items: EducationalGameView[];
};

function isStaffCurriculum(actor: ApiActor) {
  return hasAnyPermission(actor, "academic.curriculum");
}

async function canCreateGames(actor: ApiActor) {
  if (isStaffCurriculum(actor)) return true;
  if (actor.roleKey !== "teacher") return false;
  const status = await getTeacherVerificationStatus(actor.userId);
  return status === "approved";
}

function gamesPath(actor: ApiActor, id?: string) {
  return gamesHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffCurriculum(actor),
    id,
  );
}

async function learnersForActor(actor: ApiActor) {
  if (actor.roleKey === "student") {
    const [user] = await db
      .select({ name: users.displayName })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1);
    return [
      { studentUserId: actor.userId, name: user?.name ?? "Student" },
    ];
  }
  if (actor.roleKey !== "parent") return [];
  const children = await db
    .select({
      id: parentChildren.childUserId,
      name: users.displayName,
    })
    .from(parentChildren)
    .innerJoin(users, eq(users.id, parentChildren.childUserId))
    .where(eq(parentChildren.parentUserId, actor.userId));
  return children.map((child) => ({
    studentUserId: child.id,
    name: child.name ?? "Student",
  }));
}

function canManageRow(actor: ApiActor, row: { createdByUserId: string }) {
  return isStaffCurriculum(actor) || row.createdByUserId === actor.userId;
}

function canSeeRow(
  actor: ApiActor,
  row: { status: EducationalGameStatus; createdByUserId: string },
) {
  if (canManageRow(actor, row)) return true;
  if (row.status !== "published") return false;
  return (
    actor.roleKey === "student" ||
    actor.roleKey === "parent" ||
    actor.roleKey === "teacher" ||
    isStaffRole(actor.roleKey)
  );
}

async function loadGameRow(id: string) {
  const [row] = await db
    .select({
      id: educationalGames.id,
      title: educationalGames.title,
      instructions: educationalGames.instructions,
      subjectSlug: educationalGames.subjectSlug,
      subjectName: subjects.name,
      kind: educationalGames.kind,
      status: educationalGames.status,
      payload: educationalGames.payload,
      createdByUserId: educationalGames.createdByUserId,
      teacherName: users.displayName,
    })
    .from(educationalGames)
    .leftJoin(subjects, eq(subjects.slug, educationalGames.subjectSlug))
    .innerJoin(users, eq(users.id, educationalGames.createdByUserId))
    .where(eq(educationalGames.id, id))
    .limit(1);
  return row ?? null;
}

async function toGameView(
  actor: ApiActor,
  row: NonNullable<Awaited<ReturnType<typeof loadGameRow>>>,
  options?: { studentUserId?: string },
): Promise<EducationalGameView> {
  const canManage = canManageRow(actor, row);
  const learners = await learnersForActor(actor);
  const canRecord = learners.length > 0;
  const selectedLearner =
    options?.studentUserId &&
    learners.some((learner) => learner.studentUserId === options.studentUserId)
      ? options.studentUserId
      : learners[0]?.studentUserId;
  const payload = parseGamePayload(row.kind, row.payload);
  const playable = gamePayloadIsPlayable(row.kind, payload);
  const canPlay = playable && (row.status === "published" || canManage);

  const playFilter = [eq(educationalGamePlays.gameId, row.id)];
  if (!canManage) {
    playFilter.push(
      eq(
        educationalGamePlays.studentUserId,
        selectedLearner ?? actor.userId,
      ),
    );
  }
  const playRows = await db
    .select({
      studentUserId: educationalGamePlays.studentUserId,
      studentName: users.displayName,
      score: educationalGamePlays.score,
      total: educationalGamePlays.total,
      completedAt: educationalGamePlays.completedAt,
    })
    .from(educationalGamePlays)
    .innerJoin(users, eq(users.id, educationalGamePlays.studentUserId))
    .where(and(...playFilter))
    .orderBy(desc(educationalGamePlays.completedAt));

  const plays: EducationalGamePlayRecord[] = playRows.map((play) => ({
    studentUserId: play.studentUserId,
    studentName: play.studentName ?? "Student",
    score: play.score,
    total: play.total,
    completedAt: play.completedAt.toISOString(),
  }));
  const lastPlay =
    plays.find((play) => play.studentUserId === selectedLearner) ??
    plays[0] ??
    null;

  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    subjectSlug: row.subjectSlug,
    subjectName: row.subjectName,
    kind: row.kind,
    status: row.status,
    teacherName: row.teacherName ?? "Teacher",
    href: gamesPath(actor, row.id),
    canManage,
    canPlay,
    canRecord,
    playCount: canManage ? plays.length : lastPlay ? 1 : 0,
    payload: canManage ? payload : null,
    play: canPlay ? toGamePlayView(row.kind, payload) : null,
    lastPlay,
    plays: canManage ? plays.slice(0, 20) : lastPlay ? [lastPlay] : [],
    learners,
  };
}

export async function listGames(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<EducationalGameView[]> {
  const teacherOnlyOwnDrafts =
    actor.roleKey === "teacher" && !isStaffCurriculum(actor);
  const learnerOnly = actor.roleKey === "student" || actor.roleKey === "parent";
  const rows = await db
    .select({
      id: educationalGames.id,
      title: educationalGames.title,
      instructions: educationalGames.instructions,
      subjectSlug: educationalGames.subjectSlug,
      subjectName: subjects.name,
      kind: educationalGames.kind,
      status: educationalGames.status,
      payload: educationalGames.payload,
      createdByUserId: educationalGames.createdByUserId,
      teacherName: users.displayName,
    })
    .from(educationalGames)
    .leftJoin(subjects, eq(subjects.slug, educationalGames.subjectSlug))
    .innerJoin(users, eq(users.id, educationalGames.createdByUserId))
    .where(
      learnerOnly
        ? eq(educationalGames.status, "published")
        : teacherOnlyOwnDrafts
          ? or(
              eq(educationalGames.createdByUserId, actor.userId),
              eq(educationalGames.status, "published"),
            )
          : undefined,
    )
    .orderBy(desc(educationalGames.updatedAt));

  const views = await Promise.all(
    rows
      .filter((row) => canSeeRow(actor, row))
      .map((row) => toGameView(actor, row, options)),
  );
  return views;
}

export async function listGamesDesk(
  actor: ApiActor,
): Promise<EducationalGameDesk> {
  if (!(await canCreateGames(actor))) {
    return { subjects: [], items: await listGames(actor) };
  }
  const [subjectRows, items] = await Promise.all([
    db
      .select({ slug: subjects.slug, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.isEnabled, true))
      .orderBy(subjects.sortOrder),
    listGames(actor),
  ]);
  return { subjects: subjectRows, items };
}

export async function getGame(
  actor: ApiActor,
  id: string,
  options?: { studentUserId?: string },
): Promise<EducationalGameView> {
  const row = await loadGameRow(id);
  if (!row || !canSeeRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Game not found");
  }
  return toGameView(actor, row, options);
}

export async function createGame(
  actor: ApiActor,
  input: {
    title: string;
    instructions?: string;
    subjectSlug?: string;
    kind: EducationalGameKind;
  },
  ip: string,
) {
  if (!(await canCreateGames(actor))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot create games");
  }
  const title = input.title.trim();
  if (title.length < 2) {
    throw new ApiError(422, "VALIDATION", "Enter a title for this game");
  }
  const subjectSlug = input.subjectSlug?.trim() || null;
  if (subjectSlug) {
    const [subject] = await db
      .select({ slug: subjects.slug })
      .from(subjects)
      .where(eq(subjects.slug, subjectSlug))
      .limit(1);
    if (!subject) {
      throw new ApiError(422, "VALIDATION", "Choose a published subject");
    }
  }
  const [created] = await db
    .insert(educationalGames)
    .values({
      title,
      instructions: input.instructions?.trim() || null,
      subjectSlug,
      kind: input.kind,
      payload: emptyGamePayload(input.kind),
      createdByUserId: actor.userId,
    })
    .returning({ id: educationalGames.id });
  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not create the game");
  }
  await writeAuditLog({
    actor,
    action: "lms.game.create",
    entityType: "educational_game",
    entityId: created.id,
    ipAddress: ip,
  });
  return listGamesDesk(actor);
}

export async function saveGame(
  actor: ApiActor,
  input: {
    gameId: string;
    title?: string;
    instructions?: string;
    subjectSlug?: string;
    payload?: unknown;
  },
  ip: string,
) {
  const row = await loadGameRow(input.gameId);
  if (!row || !canManageRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Game not found");
  }
  const title = input.title?.trim();
  const subjectSlug =
    input.subjectSlug === undefined
      ? undefined
      : input.subjectSlug.trim() || null;
  if (subjectSlug) {
    const [subject] = await db
      .select({ slug: subjects.slug })
      .from(subjects)
      .where(eq(subjects.slug, subjectSlug))
      .limit(1);
    if (!subject) {
      throw new ApiError(422, "VALIDATION", "Choose a published subject");
    }
  }
  const payload =
    input.payload === undefined
      ? undefined
      : parseGamePayload(row.kind, input.payload);
  await db
    .update(educationalGames)
    .set({
      ...(title && title.length >= 2 ? { title } : {}),
      ...(input.instructions !== undefined
        ? { instructions: input.instructions.trim() || null }
        : {}),
      ...(subjectSlug !== undefined ? { subjectSlug } : {}),
      ...(payload ? { payload } : {}),
    })
    .where(eq(educationalGames.id, row.id));
  await writeAuditLog({
    actor,
    action: "lms.game.save",
    entityType: "educational_game",
    entityId: row.id,
    ipAddress: ip,
  });
  return getGame(actor, row.id);
}

export async function setGameStatus(
  actor: ApiActor,
  input: { gameId: string; status: EducationalGameStatus },
  ip: string,
) {
  const row = await loadGameRow(input.gameId);
  if (!row || !canManageRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Game not found");
  }
  if (input.status === "published") {
    const payload = parseGamePayload(row.kind, row.payload);
    if (!gamePayloadIsPlayable(row.kind, payload)) {
      throw new ApiError(
        422,
        "VALIDATION",
        "Finish the game cards before publishing",
      );
    }
  }
  await db
    .update(educationalGames)
    .set({ status: input.status })
    .where(eq(educationalGames.id, row.id));
  await writeAuditLog({
    actor,
    action: "lms.game.status",
    entityType: "educational_game",
    entityId: row.id,
    metadata: { status: input.status },
    ipAddress: ip,
  });
  return getGame(actor, row.id);
}

export async function playGame(
  actor: ApiActor,
  input: {
    gameId: string;
    pairs?: EducationalGamePair[];
    order?: string[];
    answers?: number[];
    studentUserId?: string;
  },
  ip: string,
) {
  const row = await loadGameRow(input.gameId);
  if (!row || !canSeeRow(actor, row)) {
    throw new ApiError(404, "NOT_FOUND", "Game not found");
  }
  const canManage = canManageRow(actor, row);
  if (row.status !== "published" && !canManage) {
    throw new ApiError(403, "FORBIDDEN", "This game is not open to play");
  }
  const payload = parseGamePayload(row.kind, row.payload);
  if (!gamePayloadIsPlayable(row.kind, payload)) {
    throw new ApiError(422, "VALIDATION", "This game is not ready to play");
  }
  const result = scoreGamePlay(row.kind, payload, {
    pairs: input.pairs,
    order: input.order,
    answers: input.answers,
  });
  const learners = await learnersForActor(actor);
  const studentUserId =
    input.studentUserId &&
    learners.some((learner) => learner.studentUserId === input.studentUserId)
      ? input.studentUserId
      : learners[0]?.studentUserId;
  if (studentUserId) {
    await db.insert(educationalGamePlays).values({
      gameId: row.id,
      studentUserId,
      score: result.score,
      total: result.total,
    });
    await writeAuditLog({
      actor,
      action: "lms.game.play",
      entityType: "educational_game",
      entityId: row.id,
      metadata: { studentUserId, ...result },
      ipAddress: ip,
    });
    await safeAwardGamification({
      kind: "game",
      studentUserId,
      sourceId: row.id,
      title: row.title,
    });
  }
  const view = await getGame(actor, row.id, { studentUserId });
  return { ...view, result };
}
