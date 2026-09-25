import { BrandMark } from "@/components/brand/brand-mark";
import { CmsBody } from "@/components/cms/cms-body";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { webPageJsonLd } from "@/lib/seo-schema";
import { getPublishedCmsBySlug } from "@/server/cms/public";
import { cmsMetadata, pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";

export async function generateMetadata() {
  const page = await getPublishedCmsBySlug(["policy", "page"], "about");
  if (page) {
    return cmsMetadata(page, "/about");
  }
  const { t } = await getI18n();
  return pageMetadata({
    title: t("about.title"),
    description: t("about.description"),
    path: "/about",
  });
}

export default async function AboutPage() {
  const [{ brand, t }, page] = await Promise.all([
    getI18n(),
    getPublishedCmsBySlug(["policy", "page"], "about"),
  ]);

  return (
    <PublicShell>
      <SeoJsonLd
        data={webPageJsonLd({
          name: page?.title ?? t("about.title"),
          description: page?.excerpt ?? t("about.description"),
          path: "/about",
          type: "AboutPage",
        })}
      />
      <PageHero
        eyebrow={page ? brand.name : t("about.eyebrow")}
        title={page?.title ?? t("about.title")}
        description={page?.excerpt ?? t("about.description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: page?.title ?? t("about.title") },
          ]}
        />
      </PageHero>
      <Container className="max-w-3xl py-12 text-lg leading-8 text-muted">
        <div className="mb-8">
          <BrandMark size={56} />
        </div>
        {page ? (
          <CmsBody body={page.body} className="space-y-6" />
        ) : (
          <>
            <p>{brand.description}</p>
            <p className="mt-6">{t("about.p1", { name: brand.name })}</p>
            <p className="mt-6">{t("about.p2")}</p>
          </>
        )}
      </Container>
    </PublicShell>
  );
}
