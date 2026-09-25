import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  educationalGamePlays,
  educationalGames,
  examSittings,
  exams,
  homeworkWork,
  homeworks,
  lessonHistory,
  parentChildren,
  prerecordedCourseLessons,
  prerecordedCourseProgress,
  prerecordedCourses,
  quizAttempts,
  quizzes,
  subjects,
  users,
} from "@/db/schema";
import { examsHref } from "@/lib/exams";
import { gamesHref } from "@/lib/games";
import { homeworkHref } from "@/lib/homework";
import { libraryCourseHref } from "@/lib/library-materials";
import { quizzesHref } from "@/lib/quizzes";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import {
  familyChildReportsHref,
  REPORT_ROW_LIMIT,
  reportsHref,
  type StudentReportKind,
} from "@/lib/reports";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { assertParentOwnsChild } from "@/server/parent/children";

export type StudentReportLearner = {
  studentUserId: string;
  name: string;
  href: string;
};

export type StudentReportRow = {
  id: string;
  kind: StudentReportKind;
  title: string;
  href: string;
  subjectName: string | null;
  status: string;
  score: number | null;
  total: number | null;
  percent: number | null;
  detail: string | null;
  at: string;
};

export type StudentReport = {
  studentUserId: string;
  studentName: string;
  href: string;
  summary: {
    quizzesSat: number;
    quizzesPassed: number;
    quizzesPending: number;
    examsSat: number;
    examsPassed: number;
    examsPending: number;
    homeworkAssigned: number;
    homeworkSubmitted: number;
    homeworkMarked: number;
    gamesPlayed: number;
    coursesStarted: number;
    courseLessonsCompleted: number;
    lessonsCompleted: number;
  };
  quizzes: StudentReportRow[];
  exams: StudentReportRow[];
  homework: StudentReportRow[];
  games: StudentReportRow[];
  courses: StudentReportRow[];
  lessons: StudentReportRow[];
};

export type StudentReportDesk = {
  href: string;
  learners: StudentReportLearner[];
  report: StudentReport | null;
};

function isStaffAcademic(actor: ApiActor) {
  return hasAnyPermission(actor, [
    "academic.curriculum",
    "reports.academic",
    "students.manage",
  ]);
}

function teacherScoped(actor: ApiActor) {
  return actor.roleKey === "teacher" && !isStaffAcademic(actor);
}

function reportsPath(actor: ApiActor, studentUserId?: string) {
  return reportsHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffAcademic(actor),
    studentUserId,
  );
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
    throw new ApiError(403, "FORBIDDEN", "You cannot view this student report");
  }
  throw new ApiError(403, "FORBIDDEN", "You cannot view this student report");
}

async function listTeacherLearnerIds(teacherUserId: string) {
  const [quizRows, examRows, homeworkRows, gameRows, courseRows, lessonRows] =
    await Promise.all([
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
        .selectDistinct({ id: homeworkWork.studentUserId })
        .from(homeworkWork)
        .innerJoin(homeworks, eq(homeworks.id, homeworkWork.homeworkId))
        .where(eq(homeworks.createdByUserId, teacherUserId)),
      db
        .selectDistinct({ id: educationalGamePlays.studentUserId })
        .from(educationalGamePlays)
        .innerJoin(
          educationalGames,
          eq(educationalGames.id, educationalGamePlays.gameId),
        )
        .where(eq(educationalGames.createdByUserId, teacherUserId)),
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
    [
      ...quizRows,
      ...examRows,
      ...homeworkRows,
      ...gameRows,
      ...courseRows,
      ...lessonRows,
    ].map((row) => row.id),
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

async function listLearners(actor: ApiActor): Promise<StudentReportLearner[]> {
  if (actor.roleKey === "student") {
    const [user] = await db
      .select({ name: users.displayName })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1);
    return [
      {
        studentUserId: actor.userId,
        name: user?.name ?? "Student",
        href: reportsPath(actor, actor.userId),
      },
    ];
  }
  if (actor.roleKey === "parent") {
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
      href: familyChildReportsHref(child.id),
    }));
  }
  if (teacherScoped(actor)) {
    const ids = [...(await listTeacherLearnerIds(actor.userId))];
    const names = await namesFor(ids);
    return ids
      .map((id) => ({
        studentUserId: id,
        name: names.get(id) ?? "Student",
        href: reportsPath(actor, id),
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 60);
  }
  if (isStaffAcademic(actor)) {
    const recent = await db
      .select({ id: quizAttempts.studentUserId })
      .from(quizAttempts)
      .groupBy(quizAttempts.studentUserId)
      .orderBy(desc(sql`max(${quizAttempts.submittedAt})`))
      .limit(40);
    const extra = await db
      .select({ id: examSittings.studentUserId })
      .from(examSittings)
      .groupBy(examSittings.studentUserId)
      .orderBy(desc(sql`max(${examSittings.startedAt})`))
      .limit(40);
    const homework = await db
      .select({ id: homeworkWork.studentUserId })
      .from(homeworkWork)
      .groupBy(homeworkWork.studentUserId)
      .orderBy(desc(sql`max(${homeworkWork.updatedAt})`))
      .limit(40);
    const ids = [
      ...new Set(
        [...recent, ...extra, ...homework].map((row) => row.id),
      ),
    ].slice(0, 60);
    const names = await namesFor(ids);
    return ids
      .map((id) => ({
        studentUserId: id,
        name: names.get(id) ?? "Student",
        href: reportsPath(actor, id),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
  return [];
}

function latestByKey<T>(
  rows: T[],
  key: (row: T) => string,
) {
  const seen = new Set<string>();
  const next: T[] = [];
  for (const row of rows) {
    const id = key(row);
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(row);
  }
  return next;
}

async function buildStudentReport(
  actor: ApiActor,
  studentUserId: string,
): Promise<StudentReport> {
  const scoped = teacherScoped(actor);
  const [user] = await db
    .select({ name: users.displayName })
    .from(users)
    .where(eq(users.id, studentUserId))
    .limit(1);
  const studentName = user?.name ?? "Student";
  const quizOwner = scoped ? eq(quizzes.createdByUserId, actor.userId) : undefined;
  const examOwner = scoped ? eq(exams.createdByUserId, actor.userId) : undefined;
  const homeworkOwner = scoped
    ? eq(homeworks.createdByUserId, actor.userId)
    : undefined;
  const gameOwner = scoped
    ? eq(educationalGames.createdByUserId, actor.userId)
    : undefined;
  const courseOwner = scoped
    ? eq(prerecordedCourses.createdByUserId, actor.userId)
    : undefined;
  const lessonOwner = scoped
    ? eq(lessonHistory.teacherUserId, actor.userId)
    : undefined;

  const [quizRows, examRows, homeworkRows, gameRows, progressRows, lessonCounts, lessonRows] =
    await Promise.all([
      db
        .select({
          id: quizAttempts.id,
          quizId: quizzes.id,
          title: quizzes.title,
          subjectName: subjects.name,
          score: quizAttempts.score,
          total: quizAttempts.total,
          percent: quizAttempts.percent,
          passed: quizAttempts.passed,
          markingStatus: quizAttempts.markingStatus,
          submittedAt: quizAttempts.submittedAt,
        })
        .from(quizAttempts)
        .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
        .leftJoin(subjects, eq(subjects.slug, quizzes.subjectSlug))
        .where(
          and(eq(quizAttempts.studentUserId, studentUserId), quizOwner),
        )
        .orderBy(desc(quizAttempts.submittedAt))
        .limit(40),
      db
        .select({
          examId: exams.id,
          title: exams.title,
          subjectName: subjects.name,
          score: examSittings.score,
          total: examSittings.total,
          percent: examSittings.percent,
          passed: examSittings.passed,
          markingStatus: examSittings.markingStatus,
          submittedAt: examSittings.submittedAt,
          startedAt: examSittings.startedAt,
        })
        .from(examSittings)
        .innerJoin(exams, eq(exams.id, examSittings.examId))
        .leftJoin(subjects, eq(subjects.slug, exams.subjectSlug))
        .where(and(eq(examSittings.studentUserId, studentUserId), examOwner))
        .orderBy(desc(examSittings.startedAt))
        .limit(40),
      db
        .select({
          id: homeworkWork.id,
          homeworkId: homeworks.id,
          title: homeworks.title,
          subjectName: subjects.name,
          status: homeworkWork.status,
          markLabel: homeworkWork.markLabel,
          submittedAt: homeworkWork.submittedAt,
          markedAt: homeworkWork.markedAt,
          updatedAt: homeworkWork.updatedAt,
        })
        .from(homeworkWork)
        .innerJoin(homeworks, eq(homeworks.id, homeworkWork.homeworkId))
        .leftJoin(subjects, eq(subjects.slug, homeworks.subjectSlug))
        .where(and(eq(homeworkWork.studentUserId, studentUserId), homeworkOwner))
        .orderBy(desc(homeworkWork.updatedAt))
        .limit(40),
      db
        .select({
          id: educationalGamePlays.id,
          gameId: educationalGames.id,
          title: educationalGames.title,
          subjectName: subjects.name,
          score: educationalGamePlays.score,
          total: educationalGamePlays.total,
          completedAt: educationalGamePlays.completedAt,
        })
        .from(educationalGamePlays)
        .innerJoin(
          educationalGames,
          eq(educationalGames.id, educationalGamePlays.gameId),
        )
        .leftJoin(subjects, eq(subjects.slug, educationalGames.subjectSlug))
        .where(
          and(
            eq(educationalGamePlays.studentUserId, studentUserId),
            gameOwner,
          ),
        )
        .orderBy(desc(educationalGamePlays.completedAt))
        .limit(40),
      db
        .select({
          courseId: prerecordedCourses.id,
          title: prerecordedCourses.title,
          subjectName: subjects.name,
          completedAt: prerecordedCourseProgress.completedAt,
          lastViewedAt: prerecordedCourseProgress.lastViewedAt,
        })
        .from(prerecordedCourseProgress)
        .innerJoin(
          prerecordedCourses,
          eq(prerecordedCourses.id, prerecordedCourseProgress.courseId),
        )
        .leftJoin(subjects, eq(subjects.slug, prerecordedCourses.subjectSlug))
        .where(
          and(
            eq(prerecordedCourseProgress.studentUserId, studentUserId),
            courseOwner,
          ),
        ),
      db
        .select({
          courseId: prerecordedCourseLessons.courseId,
          count: sql<number>`count(*)::int`,
        })
        .from(prerecordedCourseLessons)
        .groupBy(prerecordedCourseLessons.courseId),
      db
        .select({
          id: lessonHistory.id,
          title: lessonHistory.title,
          subjectName: subjects.name,
          status: lessonHistory.status,
          startedAt: lessonHistory.startedAt,
        })
        .from(lessonHistory)
        .leftJoin(subjects, eq(subjects.slug, lessonHistory.subjectSlug))
        .where(and(eq(lessonHistory.studentUserId, studentUserId), lessonOwner))
        .orderBy(desc(lessonHistory.startedAt))
        .limit(20),
    ]);

  const latestQuizzes = latestByKey(quizRows, (row) => row.quizId);
  const latestGames = latestByKey(gameRows, (row) => row.gameId);
  const lessonTotalByCourse = new Map(
    lessonCounts.map((row) => [row.courseId, Number(row.count)]),
  );
  const courseMap = new Map<
    string,
    {
      title: string;
      subjectName: string | null;
      completed: number;
      lastViewedAt: Date;
    }
  >();
  for (const row of progressRows) {
    const current = courseMap.get(row.courseId) ?? {
      title: row.title,
      subjectName: row.subjectName,
      completed: 0,
      lastViewedAt: row.lastViewedAt,
    };
    if (row.completedAt) current.completed += 1;
    if (row.lastViewedAt > current.lastViewedAt) {
      current.lastViewedAt = row.lastViewedAt;
    }
    courseMap.set(row.courseId, current);
  }
  const courseItems = [...courseMap.entries()]
    .sort((left, right) => right[1].lastViewedAt.getTime() - left[1].lastViewedAt.getTime())
    .slice(0, REPORT_ROW_LIMIT)
    .map(([courseId, course]) => {
      const total = lessonTotalByCourse.get(courseId) ?? 0;
      const percent = total ? Math.round((course.completed / total) * 100) : 0;
      return {
        id: courseId,
        kind: "course" as const,
        title: course.title,
        href: libraryCourseHref(courseId),
        subjectName: course.subjectName,
        status: total && course.completed >= total ? "completed" : "started",
        score: course.completed,
        total,
        percent,
        detail: null,
        at: course.lastViewedAt.toISOString(),
      };
    });

  const quizItems: StudentReportRow[] = latestQuizzes
    .slice(0, REPORT_ROW_LIMIT)
    .map((row) => ({
      id: row.id,
      kind: "quiz",
      title: row.title,
      href: quizzesHref(
        actor.roleKey,
        isStaffRole(actor.roleKey) || isStaffAcademic(actor),
        row.quizId,
      ),
      subjectName: row.subjectName,
      status:
        row.markingStatus === "pending"
          ? "pending"
          : row.passed
            ? "passed"
            : "failed",
      score: row.score,
      total: row.total,
      percent: row.percent,
      detail: null,
      at: row.submittedAt.toISOString(),
    }));

  const examItems: StudentReportRow[] = examRows
    .slice(0, REPORT_ROW_LIMIT)
    .map((row) => ({
      id: `${row.examId}-${row.startedAt.toISOString()}`,
      kind: "exam",
      title: row.title,
      href: examsHref(
        actor.roleKey,
        isStaffRole(actor.roleKey) || isStaffAcademic(actor),
        row.examId,
      ),
      subjectName: row.subjectName,
      status: !row.submittedAt
        ? "in_progress"
        : row.markingStatus === "pending"
          ? "pending"
          : row.passed
            ? "passed"
            : "failed",
      score: row.score,
      total: row.total,
      percent: row.percent,
      detail: null,
      at: (row.submittedAt ?? row.startedAt).toISOString(),
    }));

  const homeworkItems: StudentReportRow[] = homeworkRows
    .slice(0, REPORT_ROW_LIMIT)
    .map((row) => ({
      id: row.id,
      kind: "homework",
      title: row.title,
      href: homeworkHref(
        actor.roleKey,
        isStaffRole(actor.roleKey) || isStaffAcademic(actor),
        row.homeworkId,
      ),
      subjectName: row.subjectName,
      status: row.status,
      score: null,
      total: null,
      percent: null,
      detail: row.markLabel,
      at: (row.markedAt ?? row.submittedAt ?? row.updatedAt).toISOString(),
    }));

  const gameItems: StudentReportRow[] = latestGames
    .slice(0, REPORT_ROW_LIMIT)
    .map((row) => ({
      id: row.id,
      kind: "game",
      title: row.title,
      href: gamesHref(
        actor.roleKey,
        isStaffRole(actor.roleKey) || isStaffAcademic(actor),
        row.gameId,
      ),
      subjectName: row.subjectName,
      status: "completed",
      score: row.score,
      total: row.total,
      percent: row.total ? Math.round((row.score / row.total) * 100) : 0,
      detail: null,
      at: row.completedAt.toISOString(),
    }));

  const lessonHref =
    actor.roleKey === "parent"
      ? `/family/children/${studentUserId}/history`
      : actor.roleKey === "student"
        ? "/learn/history"
        : "/teach/bookings";
  const lessonItems: StudentReportRow[] = lessonRows
    .slice(0, REPORT_ROW_LIMIT)
    .map((row) => ({
      id: row.id,
      kind: "lesson",
      title: row.title,
      href: lessonHref,
      subjectName: row.subjectName,
      status: row.status === "completed" ? "completed" : row.status,
      score: null,
      total: null,
      percent: null,
      detail: null,
      at: row.startedAt.toISOString(),
    }));

  return {
    studentUserId,
    studentName,
    href: reportsPath(actor, studentUserId),
    summary: {
      quizzesSat: latestQuizzes.length,
      quizzesPassed: latestQuizzes.filter(
        (row) => row.markingStatus !== "pending" && row.passed,
      ).length,
      quizzesPending: latestQuizzes.filter((row) => row.markingStatus === "pending")
        .length,
      examsSat: examRows.filter((row) => row.submittedAt).length,
      examsPassed: examRows.filter(
        (row) =>
          row.submittedAt && row.markingStatus !== "pending" && row.passed,
      ).length,
      examsPending: examRows.filter(
        (row) => row.submittedAt && row.markingStatus === "pending",
      ).length,
      homeworkAssigned: homeworkRows.filter((row) => row.status === "assigned")
        .length,
      homeworkSubmitted: homeworkRows.filter(
        (row) => row.status === "submitted" || row.status === "marked",
      ).length,
      homeworkMarked: homeworkRows.filter((row) => row.status === "marked").length,
      gamesPlayed: gameRows.length,
      coursesStarted: courseMap.size,
      courseLessonsCompleted: progressRows.filter((row) => row.completedAt).length,
      lessonsCompleted: lessonRows.filter((row) => row.status === "completed")
        .length,
    },
    quizzes: quizItems,
    exams: examItems,
    homework: homeworkItems,
    games: gameItems,
    courses: courseItems,
    lessons: lessonItems,
  };
}

export async function getStudentReportDesk(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<StudentReportDesk> {
  const learners = await listLearners(actor);
  const requested =
    options?.studentUserId &&
    learners.some((learner) => learner.studentUserId === options.studentUserId)
      ? options.studentUserId
      : actor.roleKey === "student"
        ? actor.userId
        : learners.length === 1
          ? learners[0]!.studentUserId
          : undefined;
  if (requested) {
    await assertCanViewStudent(actor, requested);
  }
  return {
    href: reportsPath(actor, requested),
    learners,
    report: requested ? await buildStudentReport(actor, requested) : null,
  };
}

export async function getStudentReport(
  actor: ApiActor,
  studentUserId: string,
): Promise<StudentReport> {
  await assertCanViewStudent(actor, studentUserId);
  const learners = await listLearners(actor);
  if (!learners.some((learner) => learner.studentUserId === studentUserId)) {
    throw new ApiError(404, "NOT_FOUND", "Student report not found");
  }
  return buildStudentReport(actor, studentUserId);
}
