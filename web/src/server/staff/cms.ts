import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cmsDocumentLocales, cmsDocuments, locales } from "@/db/schema";
import {
  CMS_TYPES,
  cmsPublicHref,
  cmsTypeLabel,
  isMappedPolicySlug,
  isReservedCmsSlug,
  normalizeCmsSlug,
  type CmsDocumentStatus,
  type CmsDocumentType,
} from "@/lib/cms";
import { hasAnyPermission } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import type { CreateCmsDocumentInput, UpdateCmsDocumentInput } from "./schemas";

function assertCanWriteCms(actor: ApiActor) {
  if (!hasAnyPermission(actor, "cms.write")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage CMS content");
  }
}

function optionalDate(value?: string) {
  if (!value?.trim()) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", "Enter a valid date");
  }
  return date;
}

function assertSlug(type: CmsDocumentType, slug: string) {
  const normalized = normalizeCmsSlug(slug);
  if (isReservedCmsSlug(normalized)) {
    throw new ApiError(422, "VALIDATION", "That URL slug is reserved");
  }
  if (isMappedPolicySlug(normalized) && type !== "page" && type !== "policy") {
    throw new ApiError(
      422,
      "VALIDATION",
      "about and safeguarding must be policy or page documents",
    );
  }
  return normalized;
}

async function assertUniqueSlug(slug: string, exceptId?: string) {
  const [existing] = await db
    .select({ id: cmsDocuments.id })
    .from(cmsDocuments)
    .where(eq(cmsDocuments.slug, slug))
    .limit(1);
  if (existing && existing.id !== exceptId) {
    throw new ApiError(422, "VALIDATION", "That slug is already in use");
  }
}

async function loadWorkspace() {
  const [documents, localeRows, copies] = await Promise.all([
    db
      .select()
      .from(cmsDocuments)
      .orderBy(
        asc(cmsDocuments.type),
        asc(cmsDocuments.sortOrder),
        desc(cmsDocuments.updatedAt),
      ),
    db
      .select({ code: locales.code, name: locales.name })
      .from(locales)
      .where(eq(locales.isEnabled, true))
      .orderBy(locales.code),
    db.select().from(cmsDocumentLocales),
  ]);

  return {
    locales: localeRows,
    types: CMS_TYPES.map((type) => ({
      key: type,
      label: cmsTypeLabel(type),
    })),
    summary: {
      total: documents.length,
      published: documents.filter((item) => item.status === "published").length,
      draft: documents.filter((item) => item.status === "draft").length,
      banners: documents.filter((item) => item.type === "banner").length,
    },
    documents: documents.map((document) => ({
      ...document,
      href: cmsPublicHref(document.type, document.slug),
      locales: copies
        .filter((copy) => copy.documentId === document.id)
        .map((copy) => ({
          locale: copy.locale,
          title: copy.title,
          excerpt: copy.excerpt,
          body: copy.body,
          seoTitle: copy.seoTitle,
          seoDescription: copy.seoDescription,
          ctaLabel: copy.ctaLabel,
          ctaHref: copy.ctaHref,
        })),
    })),
  };
}

export async function listCmsWorkspace(actor: ApiActor) {
  assertCanWriteCms(actor);
  return loadWorkspace();
}

export async function getCmsDocument(actor: ApiActor, id: string) {
  assertCanWriteCms(actor);
  const workspace = await loadWorkspace();
  const document = workspace.documents.find((item) => item.id === id);
  if (!document) {
    throw new ApiError(404, "NOT_FOUND", "Content not found");
  }
  return { locales: workspace.locales, types: workspace.types, document };
}

export async function createCmsDocument(
  actor: ApiActor,
  input: CreateCmsDocumentInput,
  ip: string,
) {
  assertCanWriteCms(actor);
  const slug = assertSlug(input.type, input.slug);
  await assertUniqueSlug(slug);

  const [created] = await db
    .insert(cmsDocuments)
    .values({
      type: input.type,
      slug,
      pinned: input.pinned ?? false,
      sortOrder: input.sortOrder ?? 100,
      startsAt: optionalDate(input.startsAt),
      endsAt: optionalDate(input.endsAt),
      createdByUserId: actor.userId,
      updatedByUserId: actor.userId,
    })
    .returning();

  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not create the document");
  }

  await db.insert(cmsDocumentLocales).values({
    documentId: created.id,
    locale: input.locale,
    title: input.title,
    excerpt: input.excerpt?.trim() || null,
    body: input.body?.trim() || null,
    seoTitle: input.seoTitle?.trim() || null,
    seoDescription: input.seoDescription?.trim() || null,
    ctaLabel: input.ctaLabel?.trim() || null,
    ctaHref: input.ctaHref?.trim() || null,
  });

  await writeAuditLog({
    actor,
    action: "cms.document_created",
    entityType: "cms_document",
    entityId: created.id,
    ipAddress: ip,
    metadata: { type: input.type, slug },
  });

  return getCmsDocument(actor, created.id);
}

export async function updateCmsDocument(
  actor: ApiActor,
  id: string,
  input: UpdateCmsDocumentInput,
  ip: string,
) {
  assertCanWriteCms(actor);
  const [current] = await db
    .select()
    .from(cmsDocuments)
    .where(eq(cmsDocuments.id, id))
    .limit(1);
  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Content not found");
  }

  const nextType = input.type ?? current.type;
  const nextSlug = input.slug
    ? assertSlug(nextType, input.slug)
    : current.slug;
  if (nextSlug !== current.slug) {
    await assertUniqueSlug(nextSlug, current.id);
  }

  let publishedAt = current.publishedAt;
  if (input.status === "published" && current.status !== "published") {
    publishedAt = new Date();
  }
  if (input.status && input.status !== "published") {
    publishedAt = input.status === "archived" ? current.publishedAt : null;
  }

  if (input.status === "published") {
    const [copy] = await db
      .select({ id: cmsDocumentLocales.id })
      .from(cmsDocumentLocales)
      .where(eq(cmsDocumentLocales.documentId, current.id))
      .limit(1);
    if (!copy) {
      throw new ApiError(
        422,
        "VALIDATION",
        "Add at least one language before publishing",
      );
    }
  }

  await db
    .update(cmsDocuments)
    .set({
      type: nextType,
      slug: nextSlug,
      status: (input.status ?? current.status) as CmsDocumentStatus,
      pinned: input.pinned ?? current.pinned,
      sortOrder: input.sortOrder ?? current.sortOrder,
      startsAt:
        input.startsAt !== undefined
          ? optionalDate(input.startsAt)
          : current.startsAt,
      endsAt:
        input.endsAt !== undefined ? optionalDate(input.endsAt) : current.endsAt,
      publishedAt,
      updatedByUserId: actor.userId,
    })
    .where(eq(cmsDocuments.id, current.id));

  if (input.locale && input.title) {
    const [existing] = await db
      .select({ id: cmsDocumentLocales.id })
      .from(cmsDocumentLocales)
      .where(
        and(
          eq(cmsDocumentLocales.documentId, current.id),
          eq(cmsDocumentLocales.locale, input.locale),
        ),
      )
      .limit(1);

    const localeValues = {
      title: input.title,
      excerpt: input.excerpt?.trim() || null,
      body: input.body?.trim() || null,
      seoTitle: input.seoTitle?.trim() || null,
      seoDescription: input.seoDescription?.trim() || null,
      ctaLabel: input.ctaLabel?.trim() || null,
      ctaHref: input.ctaHref?.trim() || null,
    };

    if (existing) {
      await db
        .update(cmsDocumentLocales)
        .set(localeValues)
        .where(eq(cmsDocumentLocales.id, existing.id));
    } else {
      await db.insert(cmsDocumentLocales).values({
        documentId: current.id,
        locale: input.locale,
        ...localeValues,
      });
    }
  }

  await writeAuditLog({
    actor,
    action: "cms.document_updated",
    entityType: "cms_document",
    entityId: current.id,
    ipAddress: ip,
    metadata: { status: input.status ?? current.status, slug: nextSlug },
  });

  return getCmsDocument(actor, current.id);
}
