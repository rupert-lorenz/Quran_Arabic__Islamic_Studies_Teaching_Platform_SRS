import { IslamicStudiesProgressDeskView } from "@/components/lms/islamic-studies-progress-desk";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getIslamicStudiesProgressDesk } from "@/server/lms/islamic-progress";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Islamic Studies progress",
};

export default async function TeacherIslamicStudiesPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireApprovedTeacher();
  const { student } = await searchParams;
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getIslamicStudiesProgressDesk(
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
        eyebrow={t("islamic.eyebrow")}
        title={t("islamic.title")}
        description={t("islamic.help")}
      />
      <Container className="py-10">
        <IslamicStudiesProgressDeskView desk={desk} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
