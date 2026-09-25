import { ArabicProgressDeskView } from "@/components/lms/arabic-progress-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getArabicProgressDesk } from "@/server/lms/islamic-progress";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Arabic language progress",
};

export default async function FamilyArabicPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireParent();
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
    <PublicShell>
      <PageHero
        eyebrow={t("arabic.eyebrow")}
        title={t("arabic.title")}
        description={t("arabic.family_help")}
      />
      <Container className="py-10">
        <ArabicProgressDeskView desk={desk} />
      </Container>
    </PublicShell>
  );
}
