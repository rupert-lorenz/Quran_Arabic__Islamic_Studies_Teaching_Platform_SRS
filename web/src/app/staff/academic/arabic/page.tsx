import { ArabicProgressDeskView } from "@/components/lms/arabic-progress-desk";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getArabicProgressDesk } from "@/server/lms/islamic-progress";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Arabic language progress",
};

export default async function StaffArabicPage({
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
    getArabicProgressDesk(
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
        eyebrow={t("arabic.eyebrow")}
        title={t("arabic.title")}
        description={t("arabic.help")}
      />
      <ArabicProgressDeskView desk={desk} />
    </Container>
  );
}
