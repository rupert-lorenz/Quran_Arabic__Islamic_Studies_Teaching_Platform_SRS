import { QuestionBankDesk } from "@/components/lms/question-bank-desk";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listQuestionBankDesk } from "@/server/lms/question-bank";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Question bank",
};

export default async function TeacherQuestionBankPage() {
  const access = await requireApprovedTeacher();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    listQuestionBankDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("bank.eyebrow")}
        title={t("bank.title")}
        description={t("bank.help")}
      />
      <Container className="py-10">
        <QuestionBankDesk initial={desk} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
