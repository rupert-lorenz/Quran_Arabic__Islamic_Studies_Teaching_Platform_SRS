import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { cmsDocumentLocales, cmsDocuments } from "@/db/schema";
import {
  cmsPublicHref,
  type CmsDocumentType,
  type PublicCmsDocument,
} from "@/lib/cms";
import { getI18n } from "@/server/i18n/locale";

type LocaleRow = {
  locale: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

function pickLocale(rows: LocaleRow[], locale: string, fallback: string) {
  return (
    rows.find((row) => row.locale === locale) ??
    rows.find((row) => row.locale === fallback) ??
    rows[0] ??
    null
  );
}

function present(
  document: {
    id: string;
    type: CmsDocumentType;
    slug: string;
    status: "draft" | "published" | "archived";
    pinned: boolean;
    sortOrder: number;
    publishedAt: Date | null;
  },
  copy: LocaleRow,
): PublicCmsDocument {
  return {
    id: document.id,
    type: document.type,
    slug: document.slug,
    status: document.status,
    pinned: document.pinned,
    sortOrder: document.sortOrder,
    publishedAt: document.publishedAt,
    href: cmsPublicHref(document.type, document.slug),
    title: copy.title,
    excerpt: copy.excerpt,
    body: copy.body,
    seoTitle: copy.seoTitle,
    seoDescription: copy.seoDescription,
    ctaLabel: copy.ctaLabel,
    ctaHref: copy.ctaHref,
  };
}

async function loadPublished(type?: CmsDocumentType | CmsDocumentType[]) {
  const now = new Date();
  const filters = [
    eq(cmsDocuments.status, "published"),
    or(isNull(cmsDocuments.startsAt), lte(cmsDocuments.startsAt, now)),
    or(isNull(cmsDocuments.endsAt), gte(cmsDocuments.endsAt, now)),
  ];
  const types = Array.isArray(type) ? type : type ? [type] : [];
  if (types.length === 1) {
    filters.push(eq(cmsDocuments.type, types[0]));
  } else if (types.length > 1) {
    filters.push(inArray(cmsDocuments.type, types));
  }
  return db
    .select({
      id: cmsDocuments.id,
      type: cmsDocuments.type,
      slug: cmsDocuments.slug,
      status: cmsDocuments.status,
      pinned: cmsDocuments.pinned,
      sortOrder: cmsDocuments.sortOrder,
      publishedAt: cmsDocuments.publishedAt,
      startsAt: cmsDocuments.startsAt,
      endsAt: cmsDocuments.endsAt,
    })
    .from(cmsDocuments)
    .where(and(...filters))
    .orderBy(
      desc(cmsDocuments.pinned),
      asc(cmsDocuments.sortOrder),
      desc(cmsDocuments.publishedAt),
    );
}

async function attachLocales<
  T extends { id: string; type: CmsDocumentType; slug: string },
>(rows: T[], locale: string, fallback: string) {
  if (rows.length === 0) {
    return [];
  }
  const copies = await db
    .select({
      documentId: cmsDocumentLocales.documentId,
      locale: cmsDocumentLocales.locale,
      title: cmsDocumentLocales.title,
      excerpt: cmsDocumentLocales.excerpt,
      body: cmsDocumentLocales.body,
      seoTitle: cmsDocumentLocales.seoTitle,
      seoDescription: cmsDocumentLocales.seoDescription,
      ctaLabel: cmsDocumentLocales.ctaLabel,
      ctaHref: cmsDocumentLocales.ctaHref,
    })
    .from(cmsDocumentLocales)
    .where(
      inArray(
        cmsDocumentLocales.documentId,
        rows.map((row) => row.id),
      ),
    );

  return rows.flatMap((row) => {
    const copy = pickLocale(
      copies.filter((item) => item.documentId === row.id),
      locale,
      fallback,
    );
    return copy ? [present(row as T & { status: "published"; pinned: boolean; sortOrder: number; publishedAt: Date | null }, copy)] : [];
  });
}

export async function listPublishedCms(
  type?: CmsDocumentType | CmsDocumentType[],
  limit?: number,
) {
  const { locale, locales } = await getI18n();
  const fallback = locales.find((item) => item.isDefault)?.code ?? "en";
  const rows = await loadPublished(type);
  const presented = await attachLocales(rows, locale.code, fallback);
  return limit ? presented.slice(0, limit) : presented;
}

export async function getPublishedCmsBySlug(
  type: CmsDocumentType | CmsDocumentType[],
  slug: string,
) {
  const items = await listPublishedCms(type);
  return items.find((item) => item.slug === slug) ?? null;
}

export async function listActiveBanners() {
  return listPublishedCms("banner", 2);
}

export async function listCmsSitemapEntries() {
  const rows = await loadPublished();
  return rows
    .filter((row) => row.type !== "banner" && row.type !== "faq")
    .map((row) => ({
      href: cmsPublicHref(row.type, row.slug),
      publishedAt: row.publishedAt,
    }))
    .filter((item): item is { href: string; publishedAt: Date | null } =>
      Boolean(item.href),
    );
}
