import { TeacherDirectory } from "@/components/teachers/teacher-directory";
import type { TeacherSearchQuery } from "@/lib/teacher-search";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("private.title"),
    description: t("private.description"),
    path: "/live-courses",
  });
}

export default async function PrivateLessonsPage({
  searchParams,
}: {
  searchParams: Promise<TeacherSearchQuery>;
}) {
  const filters = await searchParams;
  return (
    <TeacherDirectory
      filters={filters}
      path="/live-courses"
      eyebrowKey="private.eyebrow"
      titleKey="private.title"
      descriptionKey="private.description"
      crumbKey="nav.live_courses"
      actionKey="private.choose"
      relatedHref="/group-lessons"
      relatedKey="nav.group_lessons"
    />
  );
}
