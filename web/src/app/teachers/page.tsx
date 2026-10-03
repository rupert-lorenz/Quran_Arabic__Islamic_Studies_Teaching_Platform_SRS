import { TeacherDirectory } from "@/components/teachers/teacher-directory";
import type { TeacherSearchQuery } from "@/lib/teacher-search";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("teachers.title"),
    description: t("teachers.description"),
    path: "/teachers",
  });
}

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<TeacherSearchQuery>;
}) {
  const filters = await searchParams;
  return (
    <TeacherDirectory
      filters={filters}
      path="/teachers"
      eyebrowKey="teachers.eyebrow"
      titleKey="teachers.title"
      descriptionKey="teachers.description"
      crumbKey="nav.find_teachers"
    />
  );
}
