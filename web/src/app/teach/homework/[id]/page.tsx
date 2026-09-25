import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeworkDetail } from "@/components/lms/homework-detail";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getHomework, listAssignableStudents } from "@/server/lms/homework";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Homework",
};

export default async function TeacherHomeworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireApprovedTeacher();
  const { id } = await params;
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [{ t }, item, students] = await Promise.all([
    getI18n(),
    getHomework(actor, id).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
    listAssignableStudents(actor),
  ]);
  if (!item) notFound();

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("homework.eyebrow")}
        title={item.title}
        description={t("homework.help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/teach/homework" className="text-brand underline">
            {t("homework.back")}
          </Link>
        </p>
        <HomeworkDetail initial={item} students={students} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
