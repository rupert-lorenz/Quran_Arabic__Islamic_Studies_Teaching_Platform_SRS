import { ActivityDeskView } from "@/components/lms/activity-desk";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getPresenceDesk } from "@/server/lms/presence";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Login and lesson times",
};

export default async function StaffActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireStaffPage([
    "academic.curriculum",
    "academic.certificates",
    "reports.academic",
    "classes.manage",
    "safeguarding.recordings",
  ]);
  const { student } = await searchParams;
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getPresenceDesk(
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
        eyebrow={t("activity.eyebrow")}
        title={t("activity.title")}
        description={t("activity.help")}
      />
      <ActivityDeskView desk={desk} />
    </Container>
  );
}
