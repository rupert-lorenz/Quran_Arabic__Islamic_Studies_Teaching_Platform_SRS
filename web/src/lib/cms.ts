export const CMS_TYPES = [
  "page",
  "landing",
  "policy",
  "article",
  "faq",
  "banner",
  "announcement",
] as const;

export const CMS_STATUSES = ["draft", "published", "archived"] as const;

export type CmsDocumentType = (typeof CMS_TYPES)[number];
export type CmsDocumentStatus = (typeof CMS_STATUSES)[number];

export const CMS_RESERVED_SLUGS = [
  "account",
  "api",
  "blog",
  "courses",
  "family",
  "faq",
  "forgot-password",
  "learn",
  "login",
  "news",
  "pages",
  "parents",
  "policies",
  "register",
  "reset-password",
  "robots.txt",
  "seo",
  "setup",
  "sitemap.xml",
  "staff",
  "subjects",
  "teach",
  "teachers",
  "verify-email",
] as const;

export const CMS_MAPPED_PAGE_SLUGS = ["about", "safeguarding"] as const;

export const CMS_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CmsLocaleCopy = {
  locale: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

export type PublicCmsDocument = {
  id: string;
  type: CmsDocumentType;
  slug: string;
  status: CmsDocumentStatus;
  pinned: boolean;
  sortOrder: number;
  publishedAt: Date | string | null;
  href: string | null;
  title: string;
  excerpt: string | null;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

export function normalizeCmsSlug(value: string) {
  return value.trim().toLowerCase();
}

export function isReservedCmsSlug(slug: string) {
  return (CMS_RESERVED_SLUGS as readonly string[]).includes(slug);
}

export function isMappedPolicySlug(slug: string) {
  return (CMS_MAPPED_PAGE_SLUGS as readonly string[]).includes(slug);
}

export function cmsPublicHref(
  type: CmsDocumentType,
  slug: string,
): string | null {
  if (type === "banner") {
    return null;
  }
  if (type === "article") {
    return `/blog/${slug}`;
  }
  if (type === "announcement") {
    return `/news/${slug}`;
  }
  if (type === "faq") {
    return `/faq#${slug}`;
  }
  if (type === "policy") {
    return isMappedPolicySlug(slug) ? `/${slug}` : `/policies/${slug}`;
  }
  if (isMappedPolicySlug(slug)) {
    return `/${slug}`;
  }
  return `/pages/${slug}`;
}

export function cmsTypeLabel(type: CmsDocumentType) {
  if (type === "page") return "Page";
  if (type === "landing") return "Landing";
  if (type === "policy") return "Policy";
  if (type === "article") return "Article";
  if (type === "faq") return "FAQ";
  if (type === "banner") return "Banner";
  return "Announcement";
}

export function splitCmsBlocks(body?: string | null) {
  return (body ?? "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function isCmsBulletBlock(block: string) {
  return block
    .split("\n")
    .filter((line) => line.trim())
    .every((line) => line.trim().startsWith("- "));
}
