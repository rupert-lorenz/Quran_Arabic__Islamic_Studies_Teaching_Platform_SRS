import { CmsBody } from "@/components/cms/cms-body";
import { CmsJsonLd } from "@/components/cms/cms-json-ld";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import type { PublicCmsDocument } from "@/lib/cms";
import { webPageJsonLd } from "@/lib/seo-schema";

export function CmsDocumentView({
  document,
  eyebrow,
  url,
  jsonLd,
  crumbs,
}: {
  document: PublicCmsDocument;
  eyebrow: string;
  url?: string;
  jsonLd?: "Article" | "NewsArticle";
  crumbs?: BreadcrumbItem[];
}) {
  return (
    <PublicShell>
      {jsonLd && url ? (
        <CmsJsonLd type={jsonLd} url={url} documents={[document]} />
      ) : null}
      {!jsonLd && document.href ? (
        <SeoJsonLd
          data={webPageJsonLd({
            name: document.title,
            description: document.excerpt || document.seoDescription,
            path: document.href,
          })}
        />
      ) : null}
      <PageHero
        eyebrow={eyebrow}
        title={document.title}
        description={document.excerpt ?? ""}
      >
        {crumbs ? <Breadcrumbs items={crumbs} /> : null}
      </PageHero>
      <Container className="max-w-3xl py-12">
        <CmsBody body={document.body} />
        {document.ctaHref && document.ctaLabel ? (
          <div className="mt-8">
            <ButtonLink href={document.ctaHref}>{document.ctaLabel}</ButtonLink>
          </div>
        ) : null}
      </Container>
    </PublicShell>
  );
}
