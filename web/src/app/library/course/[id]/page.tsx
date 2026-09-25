import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LibraryCoursePlayer } from "@/components/lms/library-course-player";
import { PublicShell } from "@/components/layout/public-shell";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getTeachingBook } from "@/server/lms/library";
import { getPrerecordedCourse } from "@/server/lms/prerecorded-courses";
import { getAccessContext } from "@/server/rbac/guard";

export const metadata = {
  title: "Prerecorded course",
};

function libraryHome(roleKey: string, isStaff: boolean) {
  if (roleKey === "student") return "/learn/library";
  if (roleKey === "parent") return "/family/library";
  if (roleKey === "teacher") return "/teach/library";
  if (isStaff) return "/staff/academic";
  return "/library";
}

export default async function PrerecordedCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string; student?: string }>;
}) {
  const access = await getAccessContext();
  if (!access) {
    redirect("/login");
  }
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [{ t }, course] = await Promise.all([
    getI18n(),
    getPrerecordedCourse(actor, id, {
      studentUserId: query.student,
      lessonId: query.lesson,
    }).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
  ]);
  if (!course) {
    notFound();
  }

  const selected =
    course.lessons.find((lesson) => lesson.id === query.lesson) ??
    course.lessons.find((lesson) => lesson.id === course.progress.lastLessonId) ??
    course.lessons[0] ??
    null;
  const book =
    selected && !course.isLocked
      ? await getTeachingBook(actor, selected.materialId).catch((error) => {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        })
      : null;

  const back = libraryHome(access.user.roleKey, access.isStaff);
  const body = (
    <>
      <PageHero
        eyebrow={t("library.prerecorded.title")}
        title={selected ? `${course.title} · ${selected.title}` : course.title}
        description={
          course.description ??
          (book?.viewKind === "audio"
            ? t("library.audio_help")
            : book?.viewKind === "video"
              ? t("library.video_help")
              : book?.isBook
                ? t("library.book_help")
                : t("library.prerecorded.watch"))
        }
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href={back} className="text-brand underline">
            {t("library.prerecorded.back")}
          </Link>
        </p>
        {course.isLocked ? (
          <p className="text-sm font-semibold text-muted">
            {t("library.prerecorded.locked")}
          </p>
        ) : (
          <LibraryCoursePlayer
            course={course}
            currentId={selected?.id ?? null}
            book={book}
          />
        )}
      </Container>
    </>
  );

  if (access.user.roleKey === "teacher") {
    return <TeacherWorkspaceShell>{body}</TeacherWorkspaceShell>;
  }

  return <PublicShell>{body}</PublicShell>;
}
