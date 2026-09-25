import { IslamicProgressDeskView } from "@/components/lms/islamic-progress-desk";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getIslamicProgressDesk } from "@/server/lms/islamic-progress";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Islamic education progress",
};

export default async function TeacherProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireApprovedTeacher();
  const { student } = await searchParams;
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getIslamicProgressDesk(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      { studentUserId: student },
    ),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("progress.eyebrow")}
        title={t("progress.title")}
        description={t("progress.help")}
      />
      <Container className="py-10">
        <IslamicProgressDeskView desk={desk} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
