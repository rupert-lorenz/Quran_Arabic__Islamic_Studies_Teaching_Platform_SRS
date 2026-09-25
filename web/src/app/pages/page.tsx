import { CmsCardList } from "@/components/cms/cms-card-list";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { isMappedPolicySlug } from "@/lib/cms";
import { itemListJsonLd, webPageJsonLd } from "@/lib/seo-schema";
import { listPublishedCms } from "@/server/cms/public";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("pages.title"),
    description: t("pages.description"),
    path: "/pages",
  });
}

export default async function LandingPagesIndex() {
  const [{ t }, documents] = await Promise.all([
    getI18n(),
    listPublishedCms(["landing", "page"]),
  ]);
  const items = documents.filter((item) => !isMappedPolicySlug(item.slug));

  return (
    <PublicShell>
      <SeoJsonLd
        data={webPageJsonLd({
          name: t("pages.title"),
          description: t("pages.description"),
          path: "/pages",
          type: "CollectionPage",
        })}
      />
      {items.length > 0 ? (
        <SeoJsonLd
          data={itemListJsonLd(
            "/pages",
            items
              .filter((item) => item.href)
              .map((item) => ({
                name: item.title,
                href: item.href as string,
              })),
          )}
        />
      ) : null}
      <PageHero
        eyebrow={t("pages.eyebrow")}
        title={t("pages.title")}
        description={t("pages.description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: t("pages.title") },
          ]}
        />
      </PageHero>
      <Container className="py-12">
        <CmsCardList
          items={items}
          empty={t("pages.empty")}
          readLabel={t("pages.read")}
        />
      </Container>
    </PublicShell>
  );
}
