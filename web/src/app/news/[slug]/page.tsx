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
  const item = await getPublishedCmsBySlug("announcement", slug);
  if (!item) {
    return { title: "News" };
  }
  return cmsMetadata(item, item.href ?? `/news/${slug}`);
}

export default async function NewsItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [item, { t }] = await Promise.all([
    getPublishedCmsBySlug("announcement", slug),
    getI18n(),
  ]);
  if (!item) {
    notFound();
  }
  const url = new URL(
    item.href ?? `/news/${slug}`,
    getConfig().APP_URL,
  ).toString();

  return (
    <CmsDocumentView
      document={item}
      eyebrow={t("news.eyebrow")}
      url={url}
      jsonLd="NewsArticle"
      crumbs={[
        { href: "/", label: t("crumb.home") },
        { href: "/news", label: t("news.title") },
        { label: item.title },
      ]}
    />
  );
}
