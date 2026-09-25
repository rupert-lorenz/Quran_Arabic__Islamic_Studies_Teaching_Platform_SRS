import { ParentHome } from "@/components/parents/parent-home";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getParentDashboard } from "@/server/dashboard";
import { getI18n } from "@/server/i18n/locale";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Family dashboard",
};

export default async function FamilyPage() {
  const access = await requireParent();
  const [dashboard, { t }] = await Promise.all([
    getParentDashboard(access.user.id),
    getI18n(),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("family.eyebrow")}
        title={t("family.hello", { name: access.user.displayName })}
        description={t("family.description")}
      />
      <Container className="py-10">
        <ParentHome
          displayName={access.user.displayName}
          profile={dashboard.profile}
          stats={dashboard.stats}
          actions={dashboard.actions}
          nextLesson={dashboard.nextLesson}
        />
      </Container>
    </PublicShell>
  );
}
