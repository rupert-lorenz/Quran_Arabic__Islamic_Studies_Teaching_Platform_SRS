import { AiSystemsDeskView } from "@/components/ai/ai-systems-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getAiSystemsDesk } from "@/server/ai/service";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "AI Systems",
};

export default async function FamilyAiPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; q?: string }>;
}) {
  const access = await requireParent();
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
    <PublicShell>
      <PageHero
        eyebrow={t("ai.eyebrow")}
        title={t("ai.title")}
        description={t("ai.family_help")}
      />
      <Container className="py-10">
        <AiSystemsDeskView desk={desk} />
      </Container>
    </PublicShell>
  );
}
