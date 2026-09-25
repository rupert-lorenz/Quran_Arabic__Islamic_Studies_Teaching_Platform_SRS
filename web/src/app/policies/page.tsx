import { CmsCardList } from "@/components/cms/cms-card-list";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { listPublishedCms } from "@/server/cms/public";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("policies.title"),
    description: t("policies.description"),
    path: "/policies",
  });
}

export default async function PoliciesPage() {
  const [{ t }, policies] = await Promise.all([
    getI18n(),
    listPublishedCms("policy"),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("policies.eyebrow")}
        title={t("policies.title")}
        description={t("policies.description")}
      />
      <Container className="py-12">
        <CmsCardList
          items={policies}
          empty={t("policies.empty")}
          readLabel={t("policies.read")}
        />
      </Container>
    </PublicShell>
  );
}
