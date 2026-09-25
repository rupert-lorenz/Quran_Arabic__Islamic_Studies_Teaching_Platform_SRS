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
    title: t("blog.title"),
    description: t("blog.description"),
    path: "/blog",
  });
}

export default async function BlogPage() {
  const [{ t }, articles] = await Promise.all([
    getI18n(),
    listPublishedCms("article"),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("blog.eyebrow")}
        title={t("blog.title")}
        description={t("blog.description")}
      />
      <Container className="py-12">
        <CmsCardList
          items={articles}
          empty={t("blog.empty")}
          readLabel={t("blog.read")}
        />
      </Container>
    </PublicShell>
  );
}
