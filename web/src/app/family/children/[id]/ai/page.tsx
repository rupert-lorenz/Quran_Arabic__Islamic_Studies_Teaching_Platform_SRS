import { AiSystemsDeskView } from "@/components/ai/ai-systems-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { isApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getAiSystemsDesk } from "@/server/ai/service";
import { getManagedParentChild } from "@/server/parent/children";
import { requireParent } from "@/server/rbac/guard";
import { notFound } from "next/navigation";

export const metadata = {
  title: "AI Systems",
};

export default async function FamilyChildAiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const access = await requireParent();
  const { id } = await params;
  const { q } = await searchParams;
  try {
    await getManagedParentChild(access.user.id, id);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getAiSystemsDesk(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      { studentUserId: id, q },
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
