import { notFound, redirect } from "next/navigation";
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
    return { title: "Policy" };
  }
  const policy = await getPublishedCmsBySlug("policy", slug);
  if (!policy) {
    return { title: "Policy" };
  }
  return cmsMetadata(policy, policy.href ?? `/policies/${slug}`);
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (isMappedPolicySlug(slug)) {
    redirect(`/${slug}`);
  }
  const [policy, { t }] = await Promise.all([
    getPublishedCmsBySlug("policy", slug),
    getI18n(),
  ]);
  if (!policy) {
    notFound();
  }

  return (
    <CmsDocumentView
      document={policy}
      eyebrow={t("policies.eyebrow")}
      crumbs={[
        { href: "/", label: t("crumb.home") },
        { href: "/policies", label: t("policies.title") },
        { label: policy.title },
      ]}
    />
  );
}
