import { RewardDeskView } from "@/components/lms/reward-desk";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getRewardDesk } from "@/server/lms/gamification";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Rewards",
};

export default async function TeacherRewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireApprovedTeacher();
  const { student } = await searchParams;
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getRewardDesk(
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
        eyebrow={t("reward.eyebrow")}
        title={t("reward.title")}
        description={t("reward.help")}
      />
      <Container className="py-10">
        <RewardDeskView desk={desk} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
