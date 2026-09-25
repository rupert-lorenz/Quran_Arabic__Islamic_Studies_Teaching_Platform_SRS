import { ActivityDeskView } from "@/components/lms/activity-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getPresenceDesk } from "@/server/lms/presence";
import { requireStudent } from "@/server/rbac/guard";

export const metadata = {
  title: "Login and lesson times",
};

export default async function StudentActivityPage() {
  const access = await requireStudent();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getPresenceDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("activity.eyebrow")}
        title={t("activity.title")}
        description={t("activity.student_help")}
      />
      <Container className="py-10">
        <ActivityDeskView desk={desk} />
      </Container>
    </PublicShell>
  );
}
