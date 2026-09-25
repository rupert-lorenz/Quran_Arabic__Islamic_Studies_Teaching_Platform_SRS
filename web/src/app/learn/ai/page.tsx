import { AiSystemsDeskView } from "@/components/ai/ai-systems-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getAiSystemsDesk } from "@/server/ai/service";
import { requireStudent } from "@/server/rbac/guard";

export const metadata = {
  title: "AI Systems",
};

export default async function StudentAiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const access = await requireStudent();
  const { q } = await searchParams;
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getAiSystemsDesk(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      { q },
    ),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("ai.eyebrow")}
        title={t("ai.title")}
        description={t("ai.student_help")}
      />
      <Container className="py-10">
        <AiSystemsDeskView desk={desk} />
      </Container>
    </PublicShell>
  );
}
