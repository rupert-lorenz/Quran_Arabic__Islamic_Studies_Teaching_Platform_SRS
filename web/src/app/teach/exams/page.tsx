import { ExamDesk } from "@/components/lms/exam-desk";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listExamsDesk } from "@/server/lms/exams";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Exams",
};

export default async function TeacherExamsPage() {
  const access = await requireApprovedTeacher();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    listExamsDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("exam.eyebrow")}
        title={t("exam.title")}
        description={t("exam.help")}
      />
      <Container className="py-10">
        <ExamDesk initial={desk} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
