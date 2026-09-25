import { QuranProgressDeskView } from "@/components/lms/quran-progress-desk";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getQuranProgressDesk } from "@/server/lms/islamic-progress";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Qur'an and Hifdh progress",
};

export default async function StaffQuranPage({
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
    getQuranProgressDesk(
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
        eyebrow={t("quran.eyebrow")}
        title={t("quran.title")}
        description={t("quran.help")}
      />
      <QuranProgressDeskView desk={desk} />
    </Container>
  );
}
