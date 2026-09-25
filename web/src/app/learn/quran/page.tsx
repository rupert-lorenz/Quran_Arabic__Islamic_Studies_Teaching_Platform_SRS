import { QuranProgressDeskView } from "@/components/lms/quran-progress-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getQuranProgressDesk } from "@/server/lms/islamic-progress";
import { requireStudent } from "@/server/rbac/guard";

export const metadata = {
  title: "Qur'an and Hifdh progress",
};

export default async function StudentQuranPage() {
  const access = await requireStudent();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getQuranProgressDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("quran.eyebrow")}
        title={t("quran.title")}
        description={t("quran.student_help")}
      />
      <Container className="py-10">
        <QuranProgressDeskView desk={desk} />
      </Container>
    </PublicShell>
  );
}
