import { HomeworkDesk } from "@/components/lms/homework-desk";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listHomeworkDesk } from "@/server/lms/homework";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Homework",
};

export default async function TeacherHomeworkPage() {
  const access = await requireApprovedTeacher();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    listHomeworkDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("homework.eyebrow")}
        title={t("homework.title")}
        description={t("homework.help")}
      />
      <Container className="py-10">
        <HomeworkDesk initial={desk} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
