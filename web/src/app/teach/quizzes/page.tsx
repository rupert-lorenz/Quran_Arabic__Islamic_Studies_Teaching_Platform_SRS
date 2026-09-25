import { QuizDesk } from "@/components/lms/quiz-desk";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listQuizzesDesk } from "@/server/lms/quizzes";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Quizzes",
};

export default async function TeacherQuizzesPage() {
  const access = await requireApprovedTeacher();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    listQuizzesDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("quiz.eyebrow")}
        title={t("quiz.title")}
        description={t("quiz.help")}
      />
      <Container className="py-10">
        <QuizDesk initial={desk} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
