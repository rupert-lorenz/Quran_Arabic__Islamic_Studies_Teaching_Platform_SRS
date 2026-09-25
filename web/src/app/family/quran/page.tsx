import { QuranProgressDeskView } from "@/components/lms/quran-progress-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getQuranProgressDesk } from "@/server/lms/islamic-progress";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Qur'an and Hifdh progress",
};

export default async function FamilyQuranPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireParent();
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
    <PublicShell>
      <PageHero
        eyebrow={t("quran.eyebrow")}
        title={t("quran.title")}
        description={t("quran.family_help")}
      />
      <Container className="py-10">
        <QuranProgressDeskView desk={desk} />
      </Container>
    </PublicShell>
  );
}
