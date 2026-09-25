import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LibraryAudioPlayer } from "@/components/lms/library-audio-player";
import { LibraryBookReader } from "@/components/lms/library-book-reader";
import { LibraryVideoPlayer } from "@/components/lms/library-video-player";
import { PublicShell } from "@/components/layout/public-shell";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getTeachingBook } from "@/server/lms/library";
import { getAccessContext } from "@/server/rbac/guard";

export const metadata = {
  title: "Read book",
};

function libraryHome(roleKey: string, isStaff: boolean) {
  if (roleKey === "student") return "/learn/library";
  if (roleKey === "parent") return "/family/library";
  if (roleKey === "teacher") return "/teach/library";
  if (isStaff) return "/staff/academic";
  return "/library";
}

export default async function LibraryBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await getAccessContext();
  if (!access) {
    redirect("/login");
  }
  const { id } = await params;
  const [{ t }, book] = await Promise.all([
    getI18n(),
    getTeachingBook(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      id,
    ).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
  ]);
  if (!book) {
    notFound();
  }

  const back = libraryHome(access.user.roleKey, access.isStaff);
  const body = (
    <>
      <PageHero
        eyebrow={t("library.eyebrow")}
        title={book.title}
        description={
          book.viewKind === "audio"
            ? t("library.audio_help")
            : book.viewKind === "video"
              ? t("library.video_help")
            : book.viewKind === "slides"
              ? t("library.slides_help")
              : book.isBook
                ? t("library.book_help")
                : t("library.pages_help")
        }
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href={back} className="text-brand underline">
            {t("library.back_library")}
          </Link>
        </p>
        {book.viewKind === "audio" ? (
          <LibraryAudioPlayer item={book} />
        ) : book.viewKind === "video" ? (
          <LibraryVideoPlayer item={book} />
        ) : (
          <LibraryBookReader book={book} />
        )}
      </Container>
    </>
  );

  if (access.user.roleKey === "teacher") {
    return <TeacherWorkspaceShell>{body}</TeacherWorkspaceShell>;
  }

  return <PublicShell>{body}</PublicShell>;
}
