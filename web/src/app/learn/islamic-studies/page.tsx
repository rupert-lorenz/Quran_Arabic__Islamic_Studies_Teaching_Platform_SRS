import { IslamicStudiesProgressDeskView } from "@/components/lms/islamic-studies-progress-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getIslamicStudiesProgressDesk } from "@/server/lms/islamic-progress";
import { requireStudent } from "@/server/rbac/guard";

export const metadata = {
  title: "Islamic Studies progress",
};

export default async function StudentIslamicStudiesPage() {
  const access = await requireStudent();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getIslamicStudiesProgressDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("islamic.eyebrow")}
        title={t("islamic.title")}
        description={t("islamic.student_help")}
      />
      <Container className="py-10">
        <IslamicStudiesProgressDeskView desk={desk} />
      </Container>
    </PublicShell>
  );
}
