import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  files,
  parentChildren,
  prerecordedCourseEnrollments,
  prerecordedCourseLessons,
  prerecordedCourseProgress,
  prerecordedCourses,
  studentProfiles,
  subjects,
  teachingMaterials,
  users,
} from "@/db/schema";
import {
  libraryCourseContentKind,
  libraryCourseHref,
  libraryCourseLessonHref,
  libraryCourseProgressPercent,
  libraryExpiryStillValid,
  type LibraryAccessMode,
  type LibraryCourseContentKind,
  type TeachingMaterialCategory,
  type TeachingMaterialStatus,
} from "@/lib/library-materials";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { safeMaybeIssueCertificates } from "@/server/lms/certificates";
import { safeAwardGamification } from "@/server/lms/gamification";
import { findUserByEmail } from "@/server/staff/lookup";

export type PrerecordedLessonProgress = "not_started" | "started" | "completed";

export type PrerecordedCourseLearnerProgress = {
  studentUserId: string;
  studentName: string;
  completedCount: number;
  percent: number;
};

export type PrerecordedCourseProgressView = {
  studentUserId: string | null;
  studentName: string | null;
  canRecord: boolean;
  completedCount: number;
  percent: number;
  lastLessonId: string | null;
  learners: PrerecordedCourseLearnerProgress[];
};

export type PrerecordedCourseLessonView = {
  id: string;
  materialId: string;
  title: string;
  category: TeachingMaterialCategory;
  contentKind: LibraryCourseContentKind | null;
  sortOrder: number;
  readHref: string;
  canOpen: boolean;
  progress: PrerecordedLessonProgress;
};

export type PrerecordedCourseView = {
  id: string;
  title: string;
  description: string | null;
  subjectSlug: string | null;
  subjectName: string | null;
  status: TeachingMaterialStatus;
  accessMode: LibraryAccessMode;
  lessonCount: number;
  href: string;
  isLocked: boolean;
  expiresAt: string | null;
  progress: PrerecordedCourseProgressView;
  lessons: PrerecordedCourseLessonView[];
};

export type PrerecordedCourseDesk = {
  subjects: Array<{ slug: string; name: string }>;
  materials: Array<{
    id: string;
    title: string;
    category: TeachingMaterialCategory;
    contentKind: LibraryCourseContentKind;
  }>;
  courses: Array<{
    id: string;
    title: string;
    description: string | null;
    subjectName: string | null;
    status: TeachingMaterialStatus;
    accessMode: LibraryAccessMode;
    lessons: Array<{
      id: string;
      materialId: string;
      title: string;
      contentKind: LibraryCourseContentKind | null;
    }>;
    enrollments: Array<{
      id: string;
      studentName: string;
      expiresAt: string | null;
      completedCount: number;
      percent: number;
    }>;
  }>;
};

async function learnerIdsForActor(actor: ApiActor) {
  if (actor.roleKey === "student") return [actor.userId];
  if (actor.roleKey !== "parent") return [];
  const children = await db
    .select({ id: parentChildren.childUserId })
    .from(parentChildren)
    .where(eq(parentChildren.parentUserId, actor.userId));
  return children.map((child) => child.id);
}

function requireManager(actor: ApiActor) {
  if (!hasAnyPermission(actor, "academic.curriculum")) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "You cannot manage prerecorded courses",
    );
  }
}

function parseOptionalDate(value?: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", "Enter a valid expiry date");
  }
  if (date.getTime() <= Date.now()) {
    throw new ApiError(422, "VALIDATION", "The expiry date must be in the future");
  }
  return date;
}

async function requireStudentByEmail(email: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new ApiError(404, "NOT_FOUND", "No account matches that email");
  }
  const [student] = await db
    .select({ userId: studentProfiles.userId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, user.id))
    .limit(1);
  if (!student) {
    throw new ApiError(422, "VALIDATION", "That account is not a student");
  }
  return { ...user, userId: student.userId };
}

async function requireLearnerMaterial(materialId: string) {
  const [material] = await db
    .select({
      id: teachingMaterials.id,
      title: teachingMaterials.title,
      category: teachingMaterials.category,
      audience: teachingMaterials.audience,
      mimeType: files.mimeType,
      pageCount: teachingMaterials.pageCount,
    })
    .from(teachingMaterials)
    .innerJoin(files, eq(files.id, teachingMaterials.fileId))
    .where(eq(teachingMaterials.id, materialId))
    .limit(1);
  if (!material) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  if (material.category === "teacher_guide" || material.audience !== "learners") {
    throw new ApiError(
      422,
      "VALIDATION",
      "Only learner materials can be added to a prerecorded course",
    );
  }
  const contentKind = libraryCourseContentKind(
    material.category,
    material.mimeType,
    material.pageCount ?? 0,
  );
  if (!contentKind) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Add a video, audio, PDF, or flipbook lesson",
    );
  }
  return { ...material, contentKind };
}

function emptyCourseProgress(): PrerecordedCourseProgressView {
  return {
    studentUserId: null,
    studentName: null,
    canRecord: false,
    completedCount: 0,
    percent: 0,
    lastLessonId: null,
    learners: [],
  };
}

function lessonProgressState(
  completedAt?: Date | null,
  lastViewedAt?: Date | null,
): PrerecordedLessonProgress {
  if (completedAt) return "completed";
  if (lastViewedAt) return "started";
  return "not_started";
}

export async function loadUnlockedPrerecordedMaterialIds(learnerIds: string[]) {
  if (!learnerIds.length) return new Set<string>();
  const [openLessons, enrolledLessons] = await Promise.all([
    db
      .select({ materialId: prerecordedCourseLessons.materialId })
      .from(prerecordedCourseLessons)
      .innerJoin(
        prerecordedCourses,
        eq(prerecordedCourses.id, prerecordedCourseLessons.courseId),
      )
      .where(
        and(
          eq(prerecordedCourses.status, "published"),
          eq(prerecordedCourses.accessMode, "open"),
        ),
      ),
    db
      .select({
        materialId: prerecordedCourseLessons.materialId,
        expiresAt: prerecordedCourseEnrollments.expiresAt,
        revokedAt: prerecordedCourseEnrollments.revokedAt,
      })
      .from(prerecordedCourseEnrollments)
      .innerJoin(
        prerecordedCourses,
        eq(prerecordedCourses.id, prerecordedCourseEnrollments.courseId),
      )
      .innerJoin(
        prerecordedCourseLessons,
        eq(prerecordedCourseLessons.courseId, prerecordedCourses.id),
      )
      .where(
        and(
          eq(prerecordedCourses.status, "published"),
          inArray(prerecordedCourseEnrollments.studentUserId, learnerIds),
          isNull(prerecordedCourseEnrollments.revokedAt),
        ),
      ),
  ]);
  return new Set([
    ...openLessons.map((row) => row.materialId),
    ...enrolledLessons
      .filter((row) => libraryExpiryStillValid(row.expiresAt, row.revokedAt))
      .map((row) => row.materialId),
  ]);
}

export async function loadPublishedPrerecordedLessonIds(materialIds: string[]) {
  if (!materialIds.length) return new Set<string>();
  const rows = await db
    .select({ materialId: prerecordedCourseLessons.materialId })
    .from(prerecordedCourseLessons)
    .innerJoin(
      prerecordedCourses,
      eq(prerecordedCourses.id, prerecordedCourseLessons.courseId),
    )
    .where(
      and(
        eq(prerecordedCourses.status, "published"),
        inArray(prerecordedCourseLessons.materialId, materialIds),
      ),
    );
  return new Set(rows.map((row) => row.materialId));
}

export async function listLibraryPrerecordedDesk(
  actor: ApiActor,
): Promise<PrerecordedCourseDesk> {
  requireManager(actor);
  const [subjectRows, materialRows, courseRows, lessonRows, enrollmentRows] =
    await Promise.all([
      db
        .select({ slug: subjects.slug, name: subjects.name })
        .from(subjects)
        .where(eq(subjects.isEnabled, true))
        .orderBy(asc(subjects.sortOrder)),
      db
        .select({
          id: teachingMaterials.id,
          title: teachingMaterials.title,
          category: teachingMaterials.category,
          mimeType: files.mimeType,
          pageCount: teachingMaterials.pageCount,
        })
        .from(teachingMaterials)
        .innerJoin(files, eq(files.id, teachingMaterials.fileId))
        .where(
          and(
            eq(teachingMaterials.audience, "learners"),
            eq(teachingMaterials.status, "published"),
          ),
        )
        .orderBy(teachingMaterials.title)
        .limit(200),
      db
        .select({
          id: prerecordedCourses.id,
          title: prerecordedCourses.title,
          description: prerecordedCourses.description,
          subjectName: subjects.name,
          status: prerecordedCourses.status,
          accessMode: prerecordedCourses.accessMode,
        })
        .from(prerecordedCourses)
        .leftJoin(subjects, eq(subjects.slug, prerecordedCourses.subjectSlug))
        .orderBy(asc(prerecordedCourses.sortOrder), desc(prerecordedCourses.createdAt))
        .limit(80),
      db
        .select({
          id: prerecordedCourseLessons.id,
          courseId: prerecordedCourseLessons.courseId,
          materialId: prerecordedCourseLessons.materialId,
          title: teachingMaterials.title,
          category: teachingMaterials.category,
          mimeType: files.mimeType,
          pageCount: teachingMaterials.pageCount,
          sortOrder: prerecordedCourseLessons.sortOrder,
        })
        .from(prerecordedCourseLessons)
        .innerJoin(
          teachingMaterials,
          eq(teachingMaterials.id, prerecordedCourseLessons.materialId),
        )
        .innerJoin(files, eq(files.id, teachingMaterials.fileId))
        .orderBy(asc(prerecordedCourseLessons.sortOrder)),
      db
        .select({
          id: prerecordedCourseEnrollments.id,
          courseId: prerecordedCourseEnrollments.courseId,
          studentUserId: prerecordedCourseEnrollments.studentUserId,
          studentName: users.displayName,
          expiresAt: prerecordedCourseEnrollments.expiresAt,
        })
        .from(prerecordedCourseEnrollments)
        .leftJoin(users, eq(users.id, prerecordedCourseEnrollments.studentUserId))
        .where(isNull(prerecordedCourseEnrollments.revokedAt))
        .orderBy(desc(prerecordedCourseEnrollments.createdAt)),
    ]);
  const progressRows = courseRows.length
    ? await db
        .select({
          courseId: prerecordedCourseProgress.courseId,
          studentUserId: prerecordedCourseProgress.studentUserId,
          completedAt: prerecordedCourseProgress.completedAt,
        })
        .from(prerecordedCourseProgress)
        .where(
          inArray(
            prerecordedCourseProgress.courseId,
            courseRows.map((course) => course.id),
          ),
        )
    : [];
  const completedByStudent = new Map<string, number>();
  for (const row of progressRows) {
    if (!row.completedAt) continue;
    const key = `${row.courseId}:${row.studentUserId}`;
    completedByStudent.set(key, (completedByStudent.get(key) ?? 0) + 1);
  }

  return {
    subjects: subjectRows,
    materials: materialRows
      .map((item) => {
        const contentKind = libraryCourseContentKind(
          item.category,
          item.mimeType,
          item.pageCount ?? 0,
        );
        return contentKind
          ? {
              id: item.id,
              title: item.title,
              category: item.category,
              contentKind,
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    courses: courseRows.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      subjectName: course.subjectName,
      status: course.status,
      accessMode: course.accessMode,
      lessons: lessonRows
        .filter((lesson) => lesson.courseId === course.id)
        .map((lesson) => ({
          id: lesson.id,
          materialId: lesson.materialId,
          title: lesson.title,
          contentKind: libraryCourseContentKind(
            lesson.category,
            lesson.mimeType,
            lesson.pageCount ?? 0,
          ),
        })),
      enrollments: enrollmentRows
        .filter((row) => row.courseId === course.id)
        .map((row) => {
          const lessonCount = lessonRows.filter(
            (lesson) => lesson.courseId === course.id,
          ).length;
          const completedCount =
            completedByStudent.get(`${course.id}:${row.studentUserId}`) ?? 0;
          return {
            id: row.id,
            studentName: row.studentName ?? "Student",
            expiresAt: row.expiresAt?.toISOString() ?? null,
            completedCount,
            percent: libraryCourseProgressPercent(completedCount, lessonCount),
          };
        }),
    })),
  };
}

export async function listLearnerPrerecordedCourses(
  actor: ApiActor,
  studentUserId?: string,
): Promise<PrerecordedCourseView[]> {
  const learnerIds = await learnerIdsForActor(actor);
  const canPreview =
    hasAnyPermission(actor, "academic.curriculum") ||
    actor.roleKey === "teacher" ||
    isStaffRole(actor.roleKey);
  const rows = await db
    .select({
      id: prerecordedCourses.id,
      title: prerecordedCourses.title,
      description: prerecordedCourses.description,
      subjectSlug: prerecordedCourses.subjectSlug,
      subjectName: subjects.name,
      status: prerecordedCourses.status,
      accessMode: prerecordedCourses.accessMode,
    })
    .from(prerecordedCourses)
    .leftJoin(subjects, eq(subjects.slug, prerecordedCourses.subjectSlug))
    .where(
      canPreview ? undefined : eq(prerecordedCourses.status, "published"),
    )
    .orderBy(asc(prerecordedCourses.sortOrder), desc(prerecordedCourses.createdAt))
    .limit(80);

  const courseIds = rows.map((row) => row.id);
  const [lessons, enrollments, progressRows, learnerUsers] = courseIds.length
    ? await Promise.all([
        db
          .select({
            id: prerecordedCourseLessons.id,
            courseId: prerecordedCourseLessons.courseId,
            materialId: prerecordedCourseLessons.materialId,
            title: teachingMaterials.title,
            category: teachingMaterials.category,
            mimeType: files.mimeType,
            pageCount: teachingMaterials.pageCount,
            sortOrder: prerecordedCourseLessons.sortOrder,
          })
          .from(prerecordedCourseLessons)
          .innerJoin(
            teachingMaterials,
            eq(teachingMaterials.id, prerecordedCourseLessons.materialId),
          )
          .innerJoin(files, eq(files.id, teachingMaterials.fileId))
          .where(inArray(prerecordedCourseLessons.courseId, courseIds))
          .orderBy(asc(prerecordedCourseLessons.sortOrder)),
        learnerIds.length
          ? db
              .select({
                courseId: prerecordedCourseEnrollments.courseId,
                studentUserId: prerecordedCourseEnrollments.studentUserId,
                expiresAt: prerecordedCourseEnrollments.expiresAt,
                revokedAt: prerecordedCourseEnrollments.revokedAt,
              })
              .from(prerecordedCourseEnrollments)
              .where(
                and(
                  inArray(prerecordedCourseEnrollments.courseId, courseIds),
                  inArray(prerecordedCourseEnrollments.studentUserId, learnerIds),
                  isNull(prerecordedCourseEnrollments.revokedAt),
                ),
              )
          : Promise.resolve([]),
        learnerIds.length
          ? db
              .select({
                courseId: prerecordedCourseProgress.courseId,
                lessonId: prerecordedCourseProgress.lessonId,
                studentUserId: prerecordedCourseProgress.studentUserId,
                completedAt: prerecordedCourseProgress.completedAt,
                lastViewedAt: prerecordedCourseProgress.lastViewedAt,
              })
              .from(prerecordedCourseProgress)
              .where(
                and(
                  inArray(prerecordedCourseProgress.courseId, courseIds),
                  inArray(prerecordedCourseProgress.studentUserId, learnerIds),
                ),
              )
          : Promise.resolve([]),
        learnerIds.length
          ? db
              .select({
                id: users.id,
                name: users.displayName,
              })
              .from(users)
              .where(inArray(users.id, learnerIds))
          : Promise.resolve([]),
      ])
    : [[], [], [], []];

  const validEnrollments = enrollments.filter((row) =>
    libraryExpiryStillValid(row.expiresAt, row.revokedAt),
  );
  const nameById = new Map(
    learnerUsers.map((user) => [user.id, user.name ?? "Student"]),
  );

  return rows
    .map((course) => {
      const courseEnrollments = validEnrollments.filter(
        (row) => row.courseId === course.id,
      );
      const enrollment = courseEnrollments[0];
      const isOpen = course.accessMode === "open";
      const isLocked = !canPreview && !isOpen && !enrollment;
      const courseLessons = lessons.filter((lesson) => lesson.courseId === course.id);
      const progressLearners = learnerIds.filter((id) =>
        isOpen || courseEnrollments.some((row) => row.studentUserId === id),
      );
      const learners: PrerecordedCourseLearnerProgress[] = progressLearners.map(
        (id) => {
          const completedCount = progressRows.filter(
            (row) =>
              row.courseId === course.id &&
              row.studentUserId === id &&
              row.completedAt,
          ).length;
          return {
            studentUserId: id,
            studentName: nameById.get(id) ?? "Student",
            completedCount,
            percent: libraryCourseProgressPercent(
              completedCount,
              courseLessons.length,
            ),
          };
        },
      );
      const activeStudentId =
        (studentUserId && progressLearners.includes(studentUserId)
          ? studentUserId
          : null) ??
        progressLearners[0] ??
        null;
      const activeRows = progressRows.filter(
        (row) =>
          row.courseId === course.id && row.studentUserId === activeStudentId,
      );
      const lastViewed = [...activeRows].sort(
        (left, right) =>
          right.lastViewedAt.getTime() - left.lastViewedAt.getTime(),
      )[0];
      const firstIncomplete = courseLessons.find(
        (lesson) =>
          !activeRows.some(
            (row) => row.lessonId === lesson.id && row.completedAt,
          ),
      );
      const lastLessonId =
        lastViewed?.lessonId ?? firstIncomplete?.id ?? courseLessons[0]?.id ?? null;
      const activeLearner = learners.find(
        (row) => row.studentUserId === activeStudentId,
      );
      const canRecord = Boolean(activeStudentId) && !isLocked;
      const href = lastLessonId
        ? libraryCourseLessonHref(course.id, lastLessonId, activeStudentId)
        : libraryCourseHref(course.id);
      return {
        id: course.id,
        title: course.title,
        description: course.description,
        subjectSlug: course.subjectSlug,
        subjectName: course.subjectName,
        status: course.status,
        accessMode: course.accessMode,
        lessonCount: courseLessons.length,
        href,
        isLocked,
        expiresAt:
          courseEnrollments.find((row) => row.studentUserId === activeStudentId)
            ?.expiresAt?.toISOString() ??
          enrollment?.expiresAt?.toISOString() ??
          null,
        progress: {
          studentUserId: activeStudentId,
          studentName: activeLearner?.studentName ?? null,
          canRecord,
          completedCount: activeLearner?.completedCount ?? 0,
          percent: activeLearner?.percent ?? 0,
          lastLessonId,
          learners,
        },
        lessons: courseLessons.map((lesson) => {
          const row = activeRows.find((item) => item.lessonId === lesson.id);
          return {
            id: lesson.id,
            materialId: lesson.materialId,
            title: lesson.title,
            category: lesson.category,
            contentKind: libraryCourseContentKind(
              lesson.category,
              lesson.mimeType,
              lesson.pageCount ?? 0,
            ),
            sortOrder: lesson.sortOrder,
            readHref: libraryCourseLessonHref(
              course.id,
              lesson.id,
              activeStudentId,
            ),
            canOpen: !isLocked,
            progress: lessonProgressState(row?.completedAt, row?.lastViewedAt),
          };
        }),
      };
    })
    .filter((course) => canPreview || !course.isLocked);
}

export async function getPrerecordedCourse(
  actor: ApiActor,
  id: string,
  options?: { studentUserId?: string; lessonId?: string },
): Promise<PrerecordedCourseView> {
  const courses = await listLearnerPrerecordedCourses(
    actor,
    options?.studentUserId,
  );
  const course = courses.find((item) => item.id === id);
  if (!course) {
    throw new ApiError(404, "NOT_FOUND", "Prerecorded course not found");
  }
  const lessonId =
    options?.lessonId ??
    course.progress.lastLessonId ??
    course.lessons[0]?.id;
  if (
    lessonId &&
    course.progress.canRecord &&
    !course.isLocked &&
    course.lessons.some((lesson) => lesson.id === lessonId)
  ) {
    await upsertPrerecordedLessonProgress({
      courseId: id,
      lessonId,
      studentUserId: course.progress.studentUserId!,
    });
    const refreshed = await listLearnerPrerecordedCourses(
      actor,
      options?.studentUserId,
    );
    return refreshed.find((item) => item.id === id) ?? course;
  }
  return course;
}

async function upsertPrerecordedLessonProgress(input: {
  courseId: string;
  lessonId: string;
  studentUserId: string;
  completed?: boolean | null;
}) {
  const now = new Date();
  await db
    .insert(prerecordedCourseProgress)
    .values({
      courseId: input.courseId,
      lessonId: input.lessonId,
      studentUserId: input.studentUserId,
      startedAt: now,
      lastViewedAt: now,
      completedAt: input.completed === true ? now : null,
    })
    .onConflictDoUpdate({
      target: [
        prerecordedCourseProgress.lessonId,
        prerecordedCourseProgress.studentUserId,
      ],
      set: {
        lastViewedAt: now,
        updatedAt: now,
        ...(input.completed === true ? { completedAt: now } : {}),
        ...(input.completed === false ? { completedAt: null } : {}),
      },
    });
}

export async function recordPrerecordedLessonProgress(
  actor: ApiActor,
  input: {
    action: "start" | "complete" | "reopen";
    courseId: string;
    lessonId: string;
    studentUserId?: string;
  },
  ip: string,
) {
  const course = await getPrerecordedCourse(actor, input.courseId, {
    studentUserId: input.studentUserId,
  });
  if (course.isLocked) {
    throw new ApiError(403, "FORBIDDEN", "Enrolment is required to track this course");
  }
  if (!course.progress.canRecord || !course.progress.studentUserId) {
    throw new ApiError(403, "FORBIDDEN", "Only students and parents can save course progress");
  }
  const lesson = course.lessons.find((item) => item.id === input.lessonId);
  if (!lesson) {
    throw new ApiError(404, "NOT_FOUND", "That lesson is not in this course");
  }
  const requested = input.studentUserId;
  if (
    requested &&
    !course.progress.learners.some((row) => row.studentUserId === requested)
  ) {
    throw new ApiError(403, "FORBIDDEN", "You cannot update that student's progress");
  }
  const studentUserId = requested ?? course.progress.studentUserId;
  await upsertPrerecordedLessonProgress({
    courseId: input.courseId,
    lessonId: input.lessonId,
    studentUserId,
    completed:
      input.action === "complete"
        ? true
        : input.action === "reopen"
          ? false
          : null,
  });
  if (input.action !== "start") {
    await writeAuditLog({
      actor,
      action: "library.prerecorded_progress_set",
      entityType: "prerecorded_course",
      entityId: input.courseId,
      ipAddress: ip,
      metadata: {
        lessonId: input.lessonId,
        studentUserId,
        completed: input.action === "complete",
      },
    });
  }
  const view = await getPrerecordedCourse(actor, input.courseId, {
    studentUserId,
  });
  if (input.action === "complete") {
    await safeMaybeIssueCertificates(actor, {
      kind: "course",
      studentUserId,
      sourceId: input.courseId,
      sourceTitle: view.title,
      subjectSlug: view.subjectSlug,
      percent: view.progress.percent,
    });
    await safeAwardGamification({
      kind: "course",
      studentUserId,
      sourceId: input.lessonId,
      title: lesson.title,
    });
  }
  return view;
}

export async function createPrerecordedCourse(
  actor: ApiActor,
  input: {
    title: string;
    description?: string;
    subjectSlug?: string;
    accessMode?: LibraryAccessMode;
  },
  ip: string,
) {
  requireManager(actor);
  const title = input.title.trim();
  if (title.length < 2) {
    throw new ApiError(422, "VALIDATION", "Enter a title for this course");
  }
  const subjectSlug: string | null = input.subjectSlug?.trim() || null;
  if (subjectSlug) {
    const [subject] = await db
      .select({ slug: subjects.slug })
      .from(subjects)
      .where(eq(subjects.slug, subjectSlug))
      .limit(1);
    if (!subject) {
      throw new ApiError(404, "NOT_FOUND", "Subject not found");
    }
  }
  const [created] = await db
    .insert(prerecordedCourses)
    .values({
      title,
      description: input.description?.trim() || null,
      subjectSlug,
      accessMode: input.accessMode ?? "entitled",
      createdByUserId: actor.userId,
    })
    .returning({ id: prerecordedCourses.id });
  await writeAuditLog({
    actor,
    action: "library.prerecorded_created",
    entityType: "prerecorded_course",
    entityId: created?.id ?? title,
    ipAddress: ip,
    metadata: { accessMode: input.accessMode ?? "entitled" },
  });
  return listLibraryPrerecordedDesk(actor);
}

export async function setPrerecordedCourseStatus(
  actor: ApiActor,
  input: { courseId: string; status: TeachingMaterialStatus },
  ip: string,
) {
  requireManager(actor);
  const [updated] = await db
    .update(prerecordedCourses)
    .set({ status: input.status })
    .where(eq(prerecordedCourses.id, input.courseId))
    .returning({ id: prerecordedCourses.id });
  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Prerecorded course not found");
  }
  await writeAuditLog({
    actor,
    action: "library.prerecorded_status_set",
    entityType: "prerecorded_course",
    entityId: updated.id,
    ipAddress: ip,
    metadata: { status: input.status },
  });
  return listLibraryPrerecordedDesk(actor);
}

export async function addPrerecordedCourseLesson(
  actor: ApiActor,
  input: { courseId: string; materialId: string },
  ip: string,
) {
  requireManager(actor);
  const [course, material] = await Promise.all([
    db
      .select({
        id: prerecordedCourses.id,
        accessMode: prerecordedCourses.accessMode,
      })
      .from(prerecordedCourses)
      .where(eq(prerecordedCourses.id, input.courseId))
      .limit(1),
    requireLearnerMaterial(input.materialId),
  ]);
  if (!course[0]) {
    throw new ApiError(404, "NOT_FOUND", "Prerecorded course not found");
  }
  const [last] = await db
    .select({ sortOrder: prerecordedCourseLessons.sortOrder })
    .from(prerecordedCourseLessons)
    .where(eq(prerecordedCourseLessons.courseId, input.courseId))
    .orderBy(desc(prerecordedCourseLessons.sortOrder))
    .limit(1);
  try {
    await db.insert(prerecordedCourseLessons).values({
      courseId: input.courseId,
      materialId: material.id,
      sortOrder: (last?.sortOrder ?? 0) + 10,
    });
  } catch {
    throw new ApiError(409, "CONFLICT", "That lesson is already in this course");
  }
  if (course[0].accessMode === "entitled") {
    await db
      .update(teachingMaterials)
      .set({ accessMode: "entitled" })
      .where(eq(teachingMaterials.id, material.id));
  }
  await writeAuditLog({
    actor,
    action: "library.prerecorded_lesson_added",
    entityType: "prerecorded_course",
    entityId: input.courseId,
    ipAddress: ip,
    metadata: { materialId: material.id },
  });
  return listLibraryPrerecordedDesk(actor);
}

export async function removePrerecordedCourseLesson(
  actor: ApiActor,
  input: { lessonId: string },
  ip: string,
) {
  requireManager(actor);
  const [removed] = await db
    .delete(prerecordedCourseLessons)
    .where(eq(prerecordedCourseLessons.id, input.lessonId))
    .returning({
      id: prerecordedCourseLessons.id,
      courseId: prerecordedCourseLessons.courseId,
    });
  if (!removed) {
    throw new ApiError(404, "NOT_FOUND", "That lesson is not in the course");
  }
  await writeAuditLog({
    actor,
    action: "library.prerecorded_lesson_removed",
    entityType: "prerecorded_course",
    entityId: removed.courseId,
    ipAddress: ip,
    metadata: { lessonId: removed.id },
  });
  return listLibraryPrerecordedDesk(actor);
}

export async function enrollPrerecordedCourse(
  actor: ApiActor,
  input: { courseId: string; email: string; expiresAt?: string },
  ip: string,
) {
  requireManager(actor);
  const [student, course] = await Promise.all([
    requireStudentByEmail(input.email),
    db
      .select({ id: prerecordedCourses.id })
      .from(prerecordedCourses)
      .where(eq(prerecordedCourses.id, input.courseId))
      .limit(1),
  ]);
  if (!course[0]) {
    throw new ApiError(404, "NOT_FOUND", "Prerecorded course not found");
  }
  const expiresAt = parseOptionalDate(input.expiresAt);
  const existing = await db
    .select({
      id: prerecordedCourseEnrollments.id,
      expiresAt: prerecordedCourseEnrollments.expiresAt,
      revokedAt: prerecordedCourseEnrollments.revokedAt,
    })
    .from(prerecordedCourseEnrollments)
    .where(
      and(
        eq(prerecordedCourseEnrollments.courseId, input.courseId),
        eq(prerecordedCourseEnrollments.studentUserId, student.userId),
      ),
    )
    .limit(1);
  if (existing[0] && libraryExpiryStillValid(existing[0].expiresAt, existing[0].revokedAt)) {
    throw new ApiError(409, "CONFLICT", "That student is already enrolled");
  }
  if (existing[0]) {
    await db
      .update(prerecordedCourseEnrollments)
      .set({
        revokedAt: null,
        expiresAt,
        enrolledByUserId: actor.userId,
      })
      .where(eq(prerecordedCourseEnrollments.id, existing[0].id));
  } else {
    await db.insert(prerecordedCourseEnrollments).values({
      courseId: input.courseId,
      studentUserId: student.userId,
      enrolledByUserId: actor.userId,
      expiresAt,
    });
  }
  await writeAuditLog({
    actor,
    action: "library.prerecorded_enrolled",
    entityType: "prerecorded_course",
    entityId: input.courseId,
    ipAddress: ip,
    metadata: {
      studentUserId: student.userId,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  });
  return listLibraryPrerecordedDesk(actor);
}

export async function revokePrerecordedCourseEnrollment(
  actor: ApiActor,
  input: { enrollmentId: string },
  ip: string,
) {
  requireManager(actor);
  const [revoked] = await db
    .update(prerecordedCourseEnrollments)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(prerecordedCourseEnrollments.id, input.enrollmentId),
        isNull(prerecordedCourseEnrollments.revokedAt),
      ),
    )
    .returning({
      id: prerecordedCourseEnrollments.id,
      courseId: prerecordedCourseEnrollments.courseId,
    });
  if (!revoked) {
    throw new ApiError(404, "NOT_FOUND", "That enrollment was not found");
  }
  await writeAuditLog({
    actor,
    action: "library.prerecorded_revoked",
    entityType: "prerecorded_course",
    entityId: revoked.courseId,
    ipAddress: ip,
    metadata: { enrollmentId: revoked.id },
  });
  return listLibraryPrerecordedDesk(actor);
}
