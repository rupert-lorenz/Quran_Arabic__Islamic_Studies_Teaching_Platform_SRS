import { notFound } from "next/navigation";
import { CmsDocumentView } from "@/components/cms/cms-document-view";
import { getPublishedCmsBySlug } from "@/server/cms/public";
import { cmsMetadata } from "@/server/cms/seo";
import { getConfig } from "@/server/config";
import { getI18n } from "@/server/i18n/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublishedCmsBySlug("article", slug);
  if (!article) {
    return { title: "Article" };
  }
  return cmsMetadata(article, article.href ?? `/blog/${slug}`);
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [article, { t }] = await Promise.all([
    getPublishedCmsBySlug("article", slug),
    getI18n(),
  ]);
  if (!article) {
    notFound();
  }
  const url = new URL(
    article.href ?? `/blog/${slug}`,
    getConfig().APP_URL,
  ).toString();

  return (
    <CmsDocumentView
      document={article}
      eyebrow={t("blog.eyebrow")}
      url={url}
      jsonLd="Article"
      crumbs={[
        { href: "/", label: t("crumb.home") },
        { href: "/blog", label: t("blog.title") },
        { label: article.title },
      ]}
    />
  );
}
