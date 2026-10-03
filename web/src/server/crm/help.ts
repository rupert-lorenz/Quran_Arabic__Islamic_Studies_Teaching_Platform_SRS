import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { cmsDocumentLocales, cmsDocuments } from "@/db/schema";
import { cmsPublicHref } from "@/lib/cms";
import type { CmsDocumentType } from "@/lib/cms";

const HELP_TYPES = ["faq", "article", "page", "policy"] as const;

function likeTerm(value: string) {
  return `%${value.replace(/[%_\\]/g, "").slice(0, 80)}%`;
}

export async function searchHelp(query: string, locale: string) {
  const term = query.trim();
  const filters = [
    eq(cmsDocuments.status, "published"),
    inArray(cmsDocuments.type, [...HELP_TYPES]),
  ];
  if (term.length >= 2) {
    const match = or(
      ilike(cmsDocumentLocales.title, likeTerm(term)),
      ilike(cmsDocumentLocales.excerpt, likeTerm(term)),
      ilike(cmsDocumentLocales.body, likeTerm(term)),
    );
    if (match) filters.push(match);
  }
  const where = and(...filters);
  const rows = await db
    .select({
      id: cmsDocuments.id,
      type: cmsDocuments.type,
      slug: cmsDocuments.slug,
      title: cmsDocumentLocales.title,
      excerpt: cmsDocumentLocales.excerpt,
      locale: cmsDocumentLocales.locale,
    })
    .from(cmsDocuments)
    .innerJoin(cmsDocumentLocales, eq(cmsDocumentLocales.documentId, cmsDocuments.id))
    .where(where)
    .orderBy(desc(cmsDocuments.publishedAt))
    .limit(40);

  const seen = new Set<string>();
  const articles = [];
  const preferred = rows.filter((row) => row.locale === locale);
  const rest = rows.filter((row) => row.locale !== locale);
  for (const row of [...preferred, ...rest]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const href = cmsPublicHref(row.type as CmsDocumentType, row.slug);
    if (!href) continue;
    articles.push({
      id: row.id,
      title: row.title,
      excerpt: row.excerpt,
      href,
    });
    if (articles.length >= 20) break;
  }
  return articles;
}

export async function helpCounts() {
  const [row] = await db
    .select({
      articles: sql<number>`count(*) filter (where ${cmsDocuments.type} = 'article')`,
      faqs: sql<number>`count(*) filter (where ${cmsDocuments.type} = 'faq')`,
      pages: sql<number>`count(*) filter (where ${cmsDocuments.type} in ('page','policy'))`,
    })
    .from(cmsDocuments)
    .where(
      and(eq(cmsDocuments.status, "published"), inArray(cmsDocuments.type, [...HELP_TYPES])),
    );
  return {
    articles: Number(row?.articles ?? 0),
    faqs: Number(row?.faqs ?? 0),
    pages: Number(row?.pages ?? 0),
  };
}
