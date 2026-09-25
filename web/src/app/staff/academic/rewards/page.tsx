import { RewardDeskView } from "@/components/lms/reward-desk";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getRewardDesk } from "@/server/lms/gamification";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Rewards",
};

export default async function StaffRewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireStaffPage([
    "academic.curriculum",
    "academic.certificates",
    "reports.academic",
  ]);
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
    <Container className="py-10">
      <PageHero
        eyebrow={t("reward.eyebrow")}
        title={t("reward.title")}
        description={t("reward.help")}
      />
      <RewardDeskView desk={desk} />
    </Container>
  );
}
