import { notFound } from "next/navigation";
import { CmsDocumentView } from "@/components/cms/cms-document-view";
import { isMappedPolicySlug } from "@/lib/cms";
import { getPublishedCmsBySlug } from "@/server/cms/public";
import { cmsMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (isMappedPolicySlug(slug)) {
    return { title: "Page" };
  }
  const page = await getPublishedCmsBySlug(["landing", "page"], slug);
  if (!page) {
    return { title: "Page" };
  }
  return cmsMetadata(page, page.href ?? `/pages/${slug}`);
}

export default async function CmsLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (isMappedPolicySlug(slug)) {
    notFound();
  }
  const [page, { t }] = await Promise.all([
    getPublishedCmsBySlug(["landing", "page"], slug),
    getI18n(),
  ]);
  if (!page) {
    notFound();
  }

  return (
    <CmsDocumentView
      document={page}
      eyebrow={t("pages.eyebrow")}
      crumbs={[
        { href: "/", label: t("crumb.home") },
        { href: "/pages", label: t("pages.title") },
        { label: page.title },
      ]}
    />
  );
}
