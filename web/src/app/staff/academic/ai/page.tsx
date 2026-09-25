import { AiSystemsDeskView } from "@/components/ai/ai-systems-desk";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getAiSystemsDesk } from "@/server/ai/service";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "AI Systems",
};

export default async function StaffAiPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; q?: string }>;
}) {
  const access = await requireStaffPage([
    "academic.curriculum",
    "academic.certificates",
    "reports.academic",
    "classes.manage",
    "safeguarding.recordings",
  ]);
  const { student, q } = await searchParams;
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getAiSystemsDesk(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      { studentUserId: student, q },
    ),
  ]);

  return (
    <Container className="py-10">
      <PageHero
        eyebrow={t("ai.eyebrow")}
        title={t("ai.title")}
        description={t("ai.help")}
      />
      <AiSystemsDeskView desk={desk} />
    </Container>
  );
}
