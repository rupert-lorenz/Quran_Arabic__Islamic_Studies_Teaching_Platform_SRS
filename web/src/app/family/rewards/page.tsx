import { RewardDeskView } from "@/components/lms/reward-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getRewardDesk } from "@/server/lms/gamification";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Rewards",
};

export default async function FamilyRewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireParent();
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
    <PublicShell>
      <PageHero
        eyebrow={t("reward.eyebrow")}
        title={t("reward.title")}
        description={t("reward.family_help")}
      />
      <Container className="py-10">
        <RewardDeskView desk={desk} />
      </Container>
    </PublicShell>
  );
}
