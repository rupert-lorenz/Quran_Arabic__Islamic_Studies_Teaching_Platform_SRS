import { MarkingDesk } from "@/components/lms/marking-desk";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listMarkingDesk } from "@/server/lms/marking";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Marking",
};

export default async function TeacherMarkingPage() {
  const access = await requireApprovedTeacher();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    listMarkingDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("exam.eyebrow")}
        title={t("marking.title")}
        description={t("marking.help")}
      />
      <Container className="py-10">
        <MarkingDesk initial={desk} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
