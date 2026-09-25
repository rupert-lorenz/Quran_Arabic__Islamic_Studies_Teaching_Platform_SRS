import { IslamicProgressDeskView } from "@/components/lms/islamic-progress-desk";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getIslamicProgressDesk } from "@/server/lms/islamic-progress";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Islamic education progress",
};

export default async function StaffProgressPage({
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
    <Container className="py-10">
      <PageHero
        eyebrow={t("progress.eyebrow")}
        title={t("progress.title")}
        description={t("progress.help")}
      />
      <IslamicProgressDeskView desk={desk} />
    </Container>
  );
}
