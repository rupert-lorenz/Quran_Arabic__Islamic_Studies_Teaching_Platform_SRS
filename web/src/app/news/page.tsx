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
    title: t("news.title"),
    description: t("news.description"),
    path: "/news",
  });
}

export default async function NewsPage() {
  const [{ t }, items] = await Promise.all([
    getI18n(),
    listPublishedCms("announcement"),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("news.eyebrow")}
        title={t("news.title")}
        description={t("news.description")}
      />
      <Container className="py-12">
        <CmsCardList
          items={items}
          empty={t("news.empty")}
          readLabel={t("news.read")}
        />
      </Container>
    </PublicShell>
  );
}
