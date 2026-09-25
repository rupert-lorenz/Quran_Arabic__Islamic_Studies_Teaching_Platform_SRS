import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  islamicProgress,
  islamicProgressNotes,
  islamicProgressQuranStreams,
  lessonHistory,
  parentChildren,
  studentProfiles,
  users,
} from "@/db/schema";
import {
  ARABIC_SKILLS,
  arabicCompletion,
  arabicProgressHref,
  emptyQuranStream,
  familyChildArabicHref,
  familyChildIslamicStudiesHref,
  familyChildProgressHref,
  familyChildQuranHref,
  islamicProgressHref,
  islamicStudiesProgressHref,
  isIslamicProgressTrack,
  isProgressAssessmentStatus,
  isProgressHomeworkStatus,
  isQuranMode,
  quranCompletion,
  quranProgressHref,
  quranSurahLabel,
  QURAN_MODES,
  type ArabicSkill,
  type IslamicProgressTrack,
  type ProgressAssessmentStatus,
  type ProgressHomeworkStatus,
  type QuranMode,
} from "@/lib/islamic-progress";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import { writeAuditLog } from "@/server/api/audit";
import type { ApiActor } from "@/server/api/auth";
import { requireHumanSensitiveDecision } from "@/server/ai/human-decision";
import { ApiError } from "@/server/api/errors";
import { assertParentOwnsChild } from "@/server/parent/children";

export type IslamicProgressNoteView = {
  id: string;
  body: string;
  authorName: string;
  at: string;
};

export type IslamicProgressTrackView = {
  track: IslamicProgressTrack;
  surah: number | null;
  surahLabel: string;
  juz: number | null;
  page: number | null;
  ayah: number | null;
  quranMode: QuranMode | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  listening: number | null;
  vocabulary: number | null;
  grammar: number | null;
  bookTitle: string;
  pagesNote: string;
  courseTitle: string;
  homeworkStatus: ProgressHomeworkStatus | null;
  assessmentStatus: ProgressAssessmentStatus | null;
  levelLabel: string;
  unitLabel: string;
  lessonLabel: string;
  weeklyTarget: string;
  nextLessonTarget: string;
  completionPercent: number | null;
  updatedAt: string | null;
  notes: IslamicProgressNoteView[];
};

export type IslamicProgressLearner = {
  studentUserId: string;
  name: string;
  href: string;
  quranPercent: number | null;
  arabicPercent: number | null;
  islamicPercent: number | null;
};

export type IslamicProgressProfile = {
  studentUserId: string;
  studentName: string;
  href: string;
  tracks: IslamicProgressTrackView[];
};

export type IslamicProgressDesk = {
  href: string;
  canEdit: boolean;
  learners: IslamicProgressLearner[];
  profile: IslamicProgressProfile | null;
};

export type QuranStreamView = {
  mode: QuranMode;
  surah: number | null;
  surahLabel: string;
  juz: number | null;
  page: number | null;
  ayah: number | null;
  percent: number | null;
};

export type QuranProgressLearner = {
  studentUserId: string;
  name: string;
  href: string;
  percent: number | null;
  surahLabel: string;
  juz: number | null;
};

export type QuranProgressProfile = {
  studentUserId: string;
  studentName: string;
  href: string;
  surah: number | null;
  surahLabel: string;
  juz: number | null;
  page: number | null;
  ayah: number | null;
  quranMode: QuranMode | null;
  weeklyTarget: string;
  nextLessonTarget: string;
  completionPercent: number | null;
  notes: IslamicProgressNoteView[];
  streams: QuranStreamView[];
};

export type QuranProgressDesk = {
  href: string;
  canEdit: boolean;
  learners: QuranProgressLearner[];
  profile: QuranProgressProfile | null;
};

export type ArabicSkillView = {
  skill: ArabicSkill;
  percent: number | null;
};

export type ArabicProgressLearner = {
  studentUserId: string;
  name: string;
  href: string;
  percent: number | null;
  bookTitle: string;
  levelLabel: string;
};

export type ArabicProgressProfile = {
  studentUserId: string;
  studentName: string;
  href: string;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  listening: number | null;
  vocabulary: number | null;
  grammar: number | null;
  bookTitle: string;
  pagesNote: string;
  levelLabel: string;
  unitLabel: string;
  lessonLabel: string;
  weeklyTarget: string;
  nextLessonTarget: string;
  completionPercent: number | null;
  notes: IslamicProgressNoteView[];
  skills: ArabicSkillView[];
};

export type ArabicProgressDesk = {
  href: string;
  canEdit: boolean;
  learners: ArabicProgressLearner[];
  profile: ArabicProgressProfile | null;
};

export type IslamicStudiesProgressLearner = {
  studentUserId: string;
  name: string;
  href: string;
  percent: number | null;
  courseTitle: string;
  levelLabel: string;
};

export type IslamicStudiesProgressProfile = {
  studentUserId: string;
  studentName: string;
  href: string;
  courseTitle: string;
  levelLabel: string;
  unitLabel: string;
  lessonLabel: string;
  homeworkStatus: ProgressHomeworkStatus | null;
  assessmentStatus: ProgressAssessmentStatus | null;
  weeklyTarget: string;
  nextLessonTarget: string;
  completionPercent: number | null;
  notes: IslamicProgressNoteView[];
};

export type IslamicStudiesProgressDesk = {
  href: string;
  canEdit: boolean;
  learners: IslamicStudiesProgressLearner[];
  profile: IslamicStudiesProgressProfile | null;
};

const NOTE_LIMIT = 12;
const TRACKS: IslamicProgressTrack[] = [
  "quran",
  "arabic",
  "islamic_studies",
];

function isStaffAcademic(actor: ApiActor) {
  return hasAnyPermission(actor, [
    "academic.curriculum",
    "academic.certificates",
    "reports.academic",
    "classes.manage",
    "safeguarding.recordings",
  ]);
}

function canEditProgress(actor: ApiActor) {
  return actor.roleKey === "teacher" || isStaffAcademic(actor);
}

function progressPath(actor: ApiActor, studentUserId?: string) {
  return islamicProgressHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffAcademic(actor),
    studentUserId,
  );
}

function quranPath(actor: ApiActor, studentUserId?: string) {
  return quranProgressHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffAcademic(actor),
    studentUserId,
  );
}

function arabicPath(actor: ApiActor, studentUserId?: string) {
  return arabicProgressHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffAcademic(actor),
    studentUserId,
  );
}

function islamicStudiesPath(actor: ApiActor, studentUserId?: string) {
  return islamicStudiesProgressHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffAcademic(actor),
    studentUserId,
  );
}

function emptyTrack(track: IslamicProgressTrack): IslamicProgressTrackView {
  return {
    track,
    surah: null,
    surahLabel: "",
    juz: null,
    page: null,
    ayah: null,
    quranMode: null,
    reading: null,
    writing: null,
    speaking: null,
    listening: null,
    vocabulary: null,
    grammar: null,
    bookTitle: "",
    pagesNote: "",
    courseTitle: "",
    homeworkStatus: null,
    assessmentStatus: null,
    levelLabel: "",
    unitLabel: "",
    lessonLabel: "",
    weeklyTarget: "",
    nextLessonTarget: "",
    completionPercent: null,
    updatedAt: null,
    notes: [],
  };
}

function trackCompletion(view: IslamicProgressTrackView) {
  if (view.track === "quran") {
    return quranCompletion(view.juz, view.completionPercent);
  }
  if (view.track === "arabic") {
    return (
      view.completionPercent ??
      arabicCompletion([
        view.reading,
        view.writing,
        view.speaking,
        view.listening,
        view.vocabulary,
        view.grammar,
      ])
    );
  }
  return view.completionPercent;
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
  const [historyRows, progressRows] = await Promise.all([
    db
      .selectDistinct({ id: lessonHistory.studentUserId })
      .from(lessonHistory)
      .where(eq(lessonHistory.teacherUserId, teacherUserId)),
    db
      .selectDistinct({ id: islamicProgress.studentUserId })
      .from(islamicProgress)
      .innerJoin(
        lessonHistory,
        and(
          eq(lessonHistory.studentUserId, islamicProgress.studentUserId),
          eq(lessonHistory.teacherUserId, teacherUserId),
        ),
      ),
  ]);
  return [
    ...new Set([...historyRows, ...progressRows].map((row) => row.id)),
  ].filter(Boolean);
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
    return (await listTeacherLearnerIds(actor.userId)).slice(0, 60);
  }
  if (isStaffAcademic(actor)) {
    const rows = await db
      .select({ id: islamicProgress.studentUserId })
      .from(islamicProgress)
      .groupBy(islamicProgress.studentUserId)
      .orderBy(desc(sql`max(${islamicProgress.updatedAt})`))
      .limit(60);
    if (rows.length) return rows.map((row) => row.id);
    const recent = await db
      .select({ id: lessonHistory.studentUserId })
      .from(lessonHistory)
      .groupBy(lessonHistory.studentUserId)
      .orderBy(desc(sql`max(${lessonHistory.startedAt})`))
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
    if (known.includes(studentUserId)) return;
    throw new ApiError(403, "FORBIDDEN", "You cannot view this progress");
  }
  throw new ApiError(403, "FORBIDDEN", "You cannot view this progress");
}

async function assertCanEditStudent(actor: ApiActor, studentUserId: string) {
  if (!canEditProgress(actor)) {
    throw new ApiError(403, "FORBIDDEN", "Only teachers and staff can update progress");
  }
  await assertCanViewStudent(actor, studentUserId);
}

async function loadNotes(progressIds: string[]) {
  if (!progressIds.length) return new Map<string, IslamicProgressNoteView[]>();
  const rows = await db
    .select({
      id: islamicProgressNotes.id,
      progressId: islamicProgressNotes.progressId,
      body: islamicProgressNotes.body,
      createdAt: islamicProgressNotes.createdAt,
      authorName: users.displayName,
    })
    .from(islamicProgressNotes)
    .innerJoin(users, eq(users.id, islamicProgressNotes.authorUserId))
    .where(inArray(islamicProgressNotes.progressId, progressIds))
    .orderBy(desc(islamicProgressNotes.createdAt));
  const map = new Map<string, IslamicProgressNoteView[]>();
  for (const row of rows) {
    const list = map.get(row.progressId) ?? [];
    if (list.length >= NOTE_LIMIT) continue;
    list.push({
      id: row.id,
      body: row.body,
      authorName: row.authorName ?? "Teacher",
      at: row.createdAt.toISOString(),
    });
    map.set(row.progressId, list);
  }
  return map;
}

function viewFromRow(
  track: IslamicProgressTrack,
  row: typeof islamicProgress.$inferSelect | undefined,
  notes: IslamicProgressNoteView[],
): IslamicProgressTrackView {
  const base = emptyTrack(track);
  if (!row) return base;
  return {
    ...base,
    surah: row.surah,
    surahLabel: quranSurahLabel(row.surah),
    juz: row.juz,
    page: row.page,
    ayah: row.ayah,
    quranMode: row.quranMode && isQuranMode(row.quranMode) ? row.quranMode : null,
    reading: row.reading,
    writing: row.writing,
    speaking: row.speaking,
    listening: row.listening,
    vocabulary: row.vocabulary,
    grammar: row.grammar,
    bookTitle: row.bookTitle ?? "",
    pagesNote: row.pagesNote ?? "",
    courseTitle: row.courseTitle ?? "",
    homeworkStatus:
      row.homeworkStatus && isProgressHomeworkStatus(row.homeworkStatus)
        ? row.homeworkStatus
        : null,
    assessmentStatus:
      row.assessmentStatus && isProgressAssessmentStatus(row.assessmentStatus)
        ? row.assessmentStatus
        : null,
    levelLabel: row.levelLabel ?? "",
    unitLabel: row.unitLabel ?? "",
    lessonLabel: row.lessonLabel ?? "",
    weeklyTarget: row.weeklyTarget ?? "",
    nextLessonTarget: row.nextLessonTarget ?? "",
    completionPercent: row.completionPercent,
    updatedAt: row.updatedAt.toISOString(),
    notes,
  };
}

async function tracksFor(studentUserId: string): Promise<IslamicProgressTrackView[]> {
  const rows = await db
    .select()
    .from(islamicProgress)
    .where(eq(islamicProgress.studentUserId, studentUserId));
  const notes = await loadNotes(rows.map((row) => row.id));
  return TRACKS.map((track) => {
    const row = rows.find((item) => item.track === track);
    return viewFromRow(track, row, row ? (notes.get(row.id) ?? []) : []);
  });
}

function profileFromTracks(
  actor: ApiActor,
  studentUserId: string,
  name: string,
  tracks: IslamicProgressTrackView[],
): IslamicProgressProfile {
  return {
    studentUserId,
    studentName: name,
    href:
      actor.roleKey === "parent"
        ? familyChildProgressHref(studentUserId)
        : progressPath(actor, studentUserId),
    tracks,
  };
}

export async function getIslamicProgressDesk(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<IslamicProgressDesk> {
  const ids = await listLearnerIds(actor);
  const requested = options?.studentUserId;
  if (requested) await assertCanViewStudent(actor, requested);
  if (requested && !ids.includes(requested)) ids.unshift(requested);
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
  const names = await namesFor(uniqueIds);
  const trackMap = new Map<string, IslamicProgressTrackView[]>();
  await Promise.all(
    uniqueIds.map(async (id) => {
      trackMap.set(id, await tracksFor(id));
    }),
  );
  const learners = uniqueIds
    .map((id) => {
      const tracks = trackMap.get(id) ?? TRACKS.map(emptyTrack);
      const quran = tracks.find((item) => item.track === "quran");
      const arabic = tracks.find((item) => item.track === "arabic");
      const islamic = tracks.find((item) => item.track === "islamic_studies");
      return {
        studentUserId: id,
        name: names.get(id) ?? "Student",
        href:
          actor.roleKey === "parent"
            ? familyChildProgressHref(id)
            : progressPath(actor, id),
        quranPercent: quran ? trackCompletion(quran) : null,
        arabicPercent: arabic ? trackCompletion(arabic) : null,
        islamicPercent: islamic ? trackCompletion(islamic) : null,
      };
    })
    .sort(
      (left, right) =>
        (right.quranPercent ?? -1) - (left.quranPercent ?? -1) ||
        left.name.localeCompare(right.name),
    );
  const profile = selected
    ? profileFromTracks(
        actor,
        selected,
        names.get(selected) ?? "Student",
        trackMap.get(selected) ?? TRACKS.map(emptyTrack),
      )
    : null;
  return {
    href: progressPath(actor, selected),
    canEdit: canEditProgress(actor),
    learners,
    profile,
  };
}

export async function saveIslamicProgress(
  actor: ApiActor,
  input: {
    studentUserId: string;
    track: IslamicProgressTrack;
    surah?: number;
    juz?: number;
    page?: number;
    ayah?: number;
    quranMode?: QuranMode;
    reading?: number;
    writing?: number;
    speaking?: number;
    listening?: number;
    vocabulary?: number;
    grammar?: number;
    bookTitle?: string;
    pagesNote?: string;
    courseTitle?: string;
    homeworkStatus?: ProgressHomeworkStatus;
    assessmentStatus?: ProgressAssessmentStatus;
    levelLabel?: string;
    unitLabel?: string;
    lessonLabel?: string;
    weeklyTarget?: string;
    nextLessonTarget?: string;
    completionPercent?: number;
    comment?: string;
  },
  ip: string,
) {
  requireHumanSensitiveDecision();
  if (!isIslamicProgressTrack(input.track)) {
    throw new ApiError(400, "VALIDATION", "Choose a progress track");
  }
  await assertCanEditStudent(actor, input.studentUserId);
  const [student] = await db
    .select({ id: studentProfiles.userId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, input.studentUserId))
    .limit(1);
  if (!student) {
    throw new ApiError(404, "NOT_FOUND", "Student profile not found");
  }
  const now = new Date();
  const [existing] = await db
    .select()
    .from(islamicProgress)
    .where(
      and(
        eq(islamicProgress.studentUserId, input.studentUserId),
        eq(islamicProgress.track, input.track),
      ),
    )
    .limit(1);
  const values = {
    surah: input.surah ?? null,
    juz: input.juz ?? null,
    page: input.page ?? null,
    ayah: input.ayah ?? null,
    quranMode: input.quranMode ?? null,
    reading: input.reading ?? null,
    writing: input.writing ?? null,
    speaking: input.speaking ?? null,
    listening: input.listening ?? null,
    vocabulary: input.vocabulary ?? null,
    grammar: input.grammar ?? null,
    bookTitle: input.bookTitle ?? null,
    pagesNote: input.pagesNote ?? null,
    courseTitle: input.courseTitle ?? null,
    homeworkStatus: input.homeworkStatus ?? null,
    assessmentStatus: input.assessmentStatus ?? null,
    levelLabel: input.levelLabel ?? null,
    unitLabel: input.unitLabel ?? null,
    lessonLabel: input.lessonLabel ?? null,
    weeklyTarget: input.weeklyTarget ?? null,
    nextLessonTarget: input.nextLessonTarget ?? null,
    completionPercent: input.completionPercent ?? null,
    updatedByUserId: actor.userId,
    updatedAt: now,
  };
  const row = existing
    ? (
        await db
          .update(islamicProgress)
          .set(values)
          .where(eq(islamicProgress.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(islamicProgress)
          .values({
            studentUserId: input.studentUserId,
            track: input.track,
            ...values,
          })
          .returning()
      )[0];
  if (input.comment && row) {
    await db.insert(islamicProgressNotes).values({
      progressId: row.id,
      authorUserId: actor.userId,
      body: input.comment,
    });
  }
  await writeAuditLog({
    actor,
    action: "islamic_progress.saved",
    entityType: "islamic_progress",
    entityId: row?.id ?? input.studentUserId,
    ipAddress: ip,
    metadata: { track: input.track, studentUserId: input.studentUserId },
  });
  return getIslamicProgressDesk(actor, { studentUserId: input.studentUserId });
}

function streamFromRow(
  mode: QuranMode,
  row?: typeof islamicProgressQuranStreams.$inferSelect,
): QuranStreamView {
  const empty = emptyQuranStream(mode);
  if (!row) return empty;
  return {
    ...empty,
    surah: row.surah,
    surahLabel: quranSurahLabel(row.surah),
    juz: row.juz,
    page: row.page,
    ayah: row.ayah,
    percent: row.percent ?? quranCompletion(row.juz),
  };
}

async function loadQuranStreams(progressId?: string): Promise<QuranStreamView[]> {
  if (!progressId) return QURAN_MODES.map((mode) => emptyQuranStream(mode));
  const rows = await db
    .select()
    .from(islamicProgressQuranStreams)
    .where(eq(islamicProgressQuranStreams.progressId, progressId));
  return QURAN_MODES.map((mode) =>
    streamFromRow(
      mode,
      rows.find((row) => row.mode === mode),
    ),
  );
}

async function quranProfileFor(
  actor: ApiActor,
  studentUserId: string,
  name: string,
): Promise<QuranProgressProfile> {
  const [row] = await db
    .select()
    .from(islamicProgress)
    .where(
      and(
        eq(islamicProgress.studentUserId, studentUserId),
        eq(islamicProgress.track, "quran"),
      ),
    )
    .limit(1);
  const notes = row ? (await loadNotes([row.id])).get(row.id) ?? [] : [];
  const streams = await loadQuranStreams(row?.id);
  return {
    studentUserId,
    studentName: name,
    href:
      actor.roleKey === "parent"
        ? familyChildQuranHref(studentUserId)
        : quranPath(actor, studentUserId),
    surah: row?.surah ?? null,
    surahLabel: quranSurahLabel(row?.surah),
    juz: row?.juz ?? null,
    page: row?.page ?? null,
    ayah: row?.ayah ?? null,
    quranMode:
      row?.quranMode && isQuranMode(row.quranMode) ? row.quranMode : null,
    weeklyTarget: row?.weeklyTarget ?? "",
    nextLessonTarget: row?.nextLessonTarget ?? "",
    completionPercent: quranCompletion(row?.juz, row?.completionPercent),
    notes,
    streams,
  };
}

export async function getQuranProgressDesk(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<QuranProgressDesk> {
  const ids = await listLearnerIds(actor);
  const requested = options?.studentUserId;
  if (requested) await assertCanViewStudent(actor, requested);
  if (requested && !ids.includes(requested)) ids.unshift(requested);
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
  const names = await namesFor(uniqueIds);
  const profiles = await Promise.all(
    uniqueIds.map((id) =>
      quranProfileFor(actor, id, names.get(id) ?? "Student"),
    ),
  );
  const learners = profiles
    .map((profile) => ({
      studentUserId: profile.studentUserId,
      name: profile.studentName,
      href: profile.href,
      percent: profile.completionPercent,
      surahLabel: profile.surahLabel,
      juz: profile.juz,
    }))
    .sort(
      (left, right) =>
        (right.percent ?? -1) - (left.percent ?? -1) ||
        left.name.localeCompare(right.name),
    );
  return {
    href: quranPath(actor, selected),
    canEdit: canEditProgress(actor),
    learners,
    profile: selected
      ? (profiles.find((item) => item.studentUserId === selected) ?? null)
      : null,
  };
}

export async function saveQuranProgress(
  actor: ApiActor,
  input: {
    studentUserId: string;
    surah?: number;
    juz?: number;
    page?: number;
    ayah?: number;
    quranMode?: QuranMode;
    weeklyTarget?: string;
    nextLessonTarget?: string;
    comment?: string;
    memorisationSurah?: number;
    memorisationJuz?: number;
    memorisationPage?: number;
    memorisationAyah?: number;
    memorisationPercent?: number;
    revisionSurah?: number;
    revisionJuz?: number;
    revisionPage?: number;
    revisionAyah?: number;
    revisionPercent?: number;
    tajweedSurah?: number;
    tajweedJuz?: number;
    tajweedPage?: number;
    tajweedAyah?: number;
    tajweedPercent?: number;
    readingSurah?: number;
    readingJuz?: number;
    readingPage?: number;
    readingAyah?: number;
    readingPercent?: number;
  },
  ip: string,
) {
  requireHumanSensitiveDecision();
  await assertCanEditStudent(actor, input.studentUserId);
  const [student] = await db
    .select({ id: studentProfiles.userId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, input.studentUserId))
    .limit(1);
  if (!student) {
    throw new ApiError(404, "NOT_FOUND", "Student profile not found");
  }
  const now = new Date();
  const [existing] = await db
    .select()
    .from(islamicProgress)
    .where(
      and(
        eq(islamicProgress.studentUserId, input.studentUserId),
        eq(islamicProgress.track, "quran"),
      ),
    )
    .limit(1);
  const values = {
    surah: input.surah ?? null,
    juz: input.juz ?? null,
    page: input.page ?? null,
    ayah: input.ayah ?? null,
    quranMode: input.quranMode ?? null,
    weeklyTarget: input.weeklyTarget ?? null,
    nextLessonTarget: input.nextLessonTarget ?? null,
    completionPercent: quranCompletion(input.juz),
    updatedByUserId: actor.userId,
    updatedAt: now,
  };
  const row = existing
    ? (
        await db
          .update(islamicProgress)
          .set(values)
          .where(eq(islamicProgress.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(islamicProgress)
          .values({
            studentUserId: input.studentUserId,
            track: "quran",
            ...values,
          })
          .returning()
      )[0];
  if (!row) {
    throw new ApiError(500, "SERVER", "Qur'an progress could not be saved");
  }
  const streams: Array<{
    mode: QuranMode;
    surah?: number;
    juz?: number;
    page?: number;
    ayah?: number;
    percent?: number;
  }> = [
    {
      mode: "memorisation",
      surah: input.memorisationSurah,
      juz: input.memorisationJuz,
      page: input.memorisationPage,
      ayah: input.memorisationAyah,
      percent: input.memorisationPercent,
    },
    {
      mode: "revision",
      surah: input.revisionSurah,
      juz: input.revisionJuz,
      page: input.revisionPage,
      ayah: input.revisionAyah,
      percent: input.revisionPercent,
    },
    {
      mode: "tajweed",
      surah: input.tajweedSurah,
      juz: input.tajweedJuz,
      page: input.tajweedPage,
      ayah: input.tajweedAyah,
      percent: input.tajweedPercent,
    },
    {
      mode: "reading",
      surah: input.readingSurah,
      juz: input.readingJuz,
      page: input.readingPage,
      ayah: input.readingAyah,
      percent: input.readingPercent,
    },
  ];
  for (const stream of streams) {
    const [current] = await db
      .select()
      .from(islamicProgressQuranStreams)
      .where(
        and(
          eq(islamicProgressQuranStreams.progressId, row.id),
          eq(islamicProgressQuranStreams.mode, stream.mode),
        ),
      )
      .limit(1);
    const streamValues = {
      surah: stream.surah ?? null,
      juz: stream.juz ?? null,
      page: stream.page ?? null,
      ayah: stream.ayah ?? null,
      percent: stream.percent ?? quranCompletion(stream.juz),
      updatedAt: now,
    };
    if (current) {
      await db
        .update(islamicProgressQuranStreams)
        .set(streamValues)
        .where(eq(islamicProgressQuranStreams.id, current.id));
    } else {
      await db.insert(islamicProgressQuranStreams).values({
        progressId: row.id,
        mode: stream.mode,
        ...streamValues,
      });
    }
  }
  if (input.comment) {
    await db.insert(islamicProgressNotes).values({
      progressId: row.id,
      authorUserId: actor.userId,
      body: input.comment,
    });
  }
  await writeAuditLog({
    actor,
    action: "quran_progress.saved",
    entityType: "islamic_progress",
    entityId: row.id,
    ipAddress: ip,
    metadata: { track: "quran", studentUserId: input.studentUserId },
  });
  return getQuranProgressDesk(actor, { studentUserId: input.studentUserId });
}

function arabicSkillsFrom(row?: {
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  listening: number | null;
  vocabulary: number | null;
  grammar: number | null;
}): ArabicSkillView[] {
  return ARABIC_SKILLS.map((skill) => ({
    skill,
    percent: row?.[skill] ?? null,
  }));
}

async function arabicProfileFor(
  actor: ApiActor,
  studentUserId: string,
  name: string,
): Promise<ArabicProgressProfile> {
  const [row] = await db
    .select()
    .from(islamicProgress)
    .where(
      and(
        eq(islamicProgress.studentUserId, studentUserId),
        eq(islamicProgress.track, "arabic"),
      ),
    )
    .limit(1);
  const notes = row ? (await loadNotes([row.id])).get(row.id) ?? [] : [];
  const skills = arabicSkillsFrom(row);
  return {
    studentUserId,
    studentName: name,
    href:
      actor.roleKey === "parent"
        ? familyChildArabicHref(studentUserId)
        : arabicPath(actor, studentUserId),
    reading: row?.reading ?? null,
    writing: row?.writing ?? null,
    speaking: row?.speaking ?? null,
    listening: row?.listening ?? null,
    vocabulary: row?.vocabulary ?? null,
    grammar: row?.grammar ?? null,
    bookTitle: row?.bookTitle ?? "",
    pagesNote: row?.pagesNote ?? "",
    levelLabel: row?.levelLabel ?? "",
    unitLabel: row?.unitLabel ?? "",
    lessonLabel: row?.lessonLabel ?? "",
    weeklyTarget: row?.weeklyTarget ?? "",
    nextLessonTarget: row?.nextLessonTarget ?? "",
    completionPercent: arabicCompletion(skills.map((item) => item.percent)),
    notes,
    skills,
  };
}

export async function getArabicProgressDesk(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<ArabicProgressDesk> {
  const ids = await listLearnerIds(actor);
  const requested = options?.studentUserId;
  if (requested) await assertCanViewStudent(actor, requested);
  if (requested && !ids.includes(requested)) ids.unshift(requested);
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
  const names = await namesFor(uniqueIds);
  const profiles = await Promise.all(
    uniqueIds.map((id) =>
      arabicProfileFor(actor, id, names.get(id) ?? "Student"),
    ),
  );
  const learners = profiles
    .map((profile) => ({
      studentUserId: profile.studentUserId,
      name: profile.studentName,
      href: profile.href,
      percent: profile.completionPercent,
      bookTitle: profile.bookTitle,
      levelLabel: profile.levelLabel,
    }))
    .sort(
      (left, right) =>
        (right.percent ?? -1) - (left.percent ?? -1) ||
        left.name.localeCompare(right.name),
    );
  return {
    href: arabicPath(actor, selected),
    canEdit: canEditProgress(actor),
    learners,
    profile: selected
      ? (profiles.find((item) => item.studentUserId === selected) ?? null)
      : null,
  };
}

export async function saveArabicProgress(
  actor: ApiActor,
  input: {
    studentUserId: string;
    reading?: number;
    writing?: number;
    speaking?: number;
    listening?: number;
    vocabulary?: number;
    grammar?: number;
    bookTitle?: string;
    pagesNote?: string;
    levelLabel?: string;
    unitLabel?: string;
    lessonLabel?: string;
    weeklyTarget?: string;
    nextLessonTarget?: string;
    comment?: string;
  },
  ip: string,
) {
  requireHumanSensitiveDecision();
  await assertCanEditStudent(actor, input.studentUserId);
  const [student] = await db
    .select({ id: studentProfiles.userId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, input.studentUserId))
    .limit(1);
  if (!student) {
    throw new ApiError(404, "NOT_FOUND", "Student profile not found");
  }
  const now = new Date();
  const [existing] = await db
    .select()
    .from(islamicProgress)
    .where(
      and(
        eq(islamicProgress.studentUserId, input.studentUserId),
        eq(islamicProgress.track, "arabic"),
      ),
    )
    .limit(1);
  const values = {
    reading: input.reading ?? null,
    writing: input.writing ?? null,
    speaking: input.speaking ?? null,
    listening: input.listening ?? null,
    vocabulary: input.vocabulary ?? null,
    grammar: input.grammar ?? null,
    bookTitle: input.bookTitle ?? null,
    pagesNote: input.pagesNote ?? null,
    levelLabel: input.levelLabel ?? null,
    unitLabel: input.unitLabel ?? null,
    lessonLabel: input.lessonLabel ?? null,
    weeklyTarget: input.weeklyTarget ?? null,
    nextLessonTarget: input.nextLessonTarget ?? null,
    completionPercent: arabicCompletion([
      input.reading,
      input.writing,
      input.speaking,
      input.listening,
      input.vocabulary,
      input.grammar,
    ]),
    updatedByUserId: actor.userId,
    updatedAt: now,
  };
  const row = existing
    ? (
        await db
          .update(islamicProgress)
          .set(values)
          .where(eq(islamicProgress.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(islamicProgress)
          .values({
            studentUserId: input.studentUserId,
            track: "arabic",
            ...values,
          })
          .returning()
      )[0];
  if (!row) {
    throw new ApiError(500, "SERVER", "Arabic progress could not be saved");
  }
  if (input.comment) {
    await db.insert(islamicProgressNotes).values({
      progressId: row.id,
      authorUserId: actor.userId,
      body: input.comment,
    });
  }
  await writeAuditLog({
    actor,
    action: "arabic_progress.saved",
    entityType: "islamic_progress",
    entityId: row.id,
    ipAddress: ip,
    metadata: { track: "arabic", studentUserId: input.studentUserId },
  });
  return getArabicProgressDesk(actor, { studentUserId: input.studentUserId });
}

async function islamicStudiesProfileFor(
  actor: ApiActor,
  studentUserId: string,
  name: string,
): Promise<IslamicStudiesProgressProfile> {
  const [row] = await db
    .select()
    .from(islamicProgress)
    .where(
      and(
        eq(islamicProgress.studentUserId, studentUserId),
        eq(islamicProgress.track, "islamic_studies"),
      ),
    )
    .limit(1);
  const notes = row ? (await loadNotes([row.id])).get(row.id) ?? [] : [];
  return {
    studentUserId,
    studentName: name,
    href:
      actor.roleKey === "parent"
        ? familyChildIslamicStudiesHref(studentUserId)
        : islamicStudiesPath(actor, studentUserId),
    courseTitle: row?.courseTitle ?? "",
    levelLabel: row?.levelLabel ?? "",
    unitLabel: row?.unitLabel ?? "",
    lessonLabel: row?.lessonLabel ?? "",
    homeworkStatus:
      row?.homeworkStatus && isProgressHomeworkStatus(row.homeworkStatus)
        ? row.homeworkStatus
        : null,
    assessmentStatus:
      row?.assessmentStatus && isProgressAssessmentStatus(row.assessmentStatus)
        ? row.assessmentStatus
        : null,
    weeklyTarget: row?.weeklyTarget ?? "",
    nextLessonTarget: row?.nextLessonTarget ?? "",
    completionPercent: row?.completionPercent ?? null,
    notes,
  };
}

export async function getIslamicStudiesProgressDesk(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<IslamicStudiesProgressDesk> {
  const ids = await listLearnerIds(actor);
  const requested = options?.studentUserId;
  if (requested) await assertCanViewStudent(actor, requested);
  if (requested && !ids.includes(requested)) ids.unshift(requested);
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
  const names = await namesFor(uniqueIds);
  const profiles = await Promise.all(
    uniqueIds.map((id) =>
      islamicStudiesProfileFor(actor, id, names.get(id) ?? "Student"),
    ),
  );
  const learners = profiles
    .map((profile) => ({
      studentUserId: profile.studentUserId,
      name: profile.studentName,
      href: profile.href,
      percent: profile.completionPercent,
      courseTitle: profile.courseTitle,
      levelLabel: profile.levelLabel,
    }))
    .sort(
      (left, right) =>
        (right.percent ?? -1) - (left.percent ?? -1) ||
        left.name.localeCompare(right.name),
    );
  return {
    href: islamicStudiesPath(actor, selected),
    canEdit: canEditProgress(actor),
    learners,
    profile: selected
      ? (profiles.find((item) => item.studentUserId === selected) ?? null)
      : null,
  };
}

export async function saveIslamicStudiesProgress(
  actor: ApiActor,
  input: {
    studentUserId: string;
    courseTitle?: string;
    levelLabel?: string;
    unitLabel?: string;
    lessonLabel?: string;
    homeworkStatus?: ProgressHomeworkStatus;
    assessmentStatus?: ProgressAssessmentStatus;
    completionPercent?: number;
    weeklyTarget?: string;
    nextLessonTarget?: string;
    comment?: string;
  },
  ip: string,
) {
  requireHumanSensitiveDecision();
  await assertCanEditStudent(actor, input.studentUserId);
  const [student] = await db
    .select({ id: studentProfiles.userId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, input.studentUserId))
    .limit(1);
  if (!student) {
    throw new ApiError(404, "NOT_FOUND", "Student profile not found");
  }
  const now = new Date();
  const [existing] = await db
    .select()
    .from(islamicProgress)
    .where(
      and(
        eq(islamicProgress.studentUserId, input.studentUserId),
        eq(islamicProgress.track, "islamic_studies"),
      ),
    )
    .limit(1);
  const values = {
    courseTitle: input.courseTitle ?? null,
    levelLabel: input.levelLabel ?? null,
    unitLabel: input.unitLabel ?? null,
    lessonLabel: input.lessonLabel ?? null,
    homeworkStatus: input.homeworkStatus ?? null,
    assessmentStatus: input.assessmentStatus ?? null,
    completionPercent: input.completionPercent ?? null,
    weeklyTarget: input.weeklyTarget ?? null,
    nextLessonTarget: input.nextLessonTarget ?? null,
    updatedByUserId: actor.userId,
    updatedAt: now,
  };
  const row = existing
    ? (
        await db
          .update(islamicProgress)
          .set(values)
          .where(eq(islamicProgress.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(islamicProgress)
          .values({
            studentUserId: input.studentUserId,
            track: "islamic_studies",
            ...values,
          })
          .returning()
      )[0];
  if (!row) {
    throw new ApiError(
      500,
      "SERVER",
      "Islamic Studies progress could not be saved",
    );
  }
  if (input.comment) {
    await db.insert(islamicProgressNotes).values({
      progressId: row.id,
      authorUserId: actor.userId,
      body: input.comment,
    });
  }
  await writeAuditLog({
    actor,
    action: "islamic_studies_progress.saved",
    entityType: "islamic_progress",
    entityId: row.id,
    ipAddress: ip,
    metadata: { track: "islamic_studies", studentUserId: input.studentUserId },
  });
  return getIslamicStudiesProgressDesk(actor, {
    studentUserId: input.studentUserId,
  });
}
