import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import {
  fileObjects,
  files,
  subjects,
  teachingMaterials,
  users,
  type TeachingMaterialPage,
} from "@/db/schema";
import { classroomContainsContactDetails } from "@/lib/classroom";
import { isClassroomEpubType, parseEpubPages } from "@/lib/classroom-epub";
import { asciiDownloadName, sanitizeClassroomFileName } from "@/lib/classroom-files";
import { parsePdfPages } from "@/lib/classroom-pdf";
import {
  isClassroomPptxType,
  parsePptxSlides,
  type ClassroomParsedSlide,
} from "@/lib/classroom-pptx";
import { detectClassroomTextDirection } from "@/lib/classroom-whiteboard";
import {
  coerceLibraryAudience,
  defaultLibraryAccessMode,
  isLibraryBookCategory,
  isLibraryBookMime,
  isLibraryCategoryMime,
  isLibraryImageMime,
  isLibraryAudioMime,
  isLibraryVideoMime,
  LIBRARY_BOOK_SUBJECT,
  LIBRARY_MAX_BOOK_PAGES,
  LIBRARY_MAX_FILE_BYTES,
  LIBRARY_MAX_SLIDES,
  libraryBookHref,
  libraryBookPageHref,
  libraryCanDownloadFile,
  libraryFileHref,
  libraryFileNeedsDownload,
  libraryMimeError,
  libraryOpenKind,
  resolveLibraryFileType,
  type LibraryAccessMode,
  type LibraryLockReason,
  type LibraryOpenKind,
  type TeachingMaterialAudience,
  type TeachingMaterialCategory,
  type TeachingMaterialStatus,
} from "@/lib/library-materials";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import {
  listLibraryAccessCatalog,
  resolveLibraryAccess,
  type LibraryAccessDecision,
} from "./entitlements";
import { listLearnerLicences } from "./licences";
import { listLearnerRentals } from "./rentals";
import { listLearnerPurchases } from "./purchases";
import { listLearnerPrerecordedCourses } from "./prerecorded-courses";
import { listLearnerSubscriptions } from "./subscriptions";
import type {
  ListTeachingLibraryInput,
  UpdateTeachingMaterialInput,
} from "./schemas";

export type TeachingMaterialView = {
  id: string;
  title: string;
  description: string | null;
  category: TeachingMaterialCategory;
  subjectSlug: string | null;
  subjectName: string | null;
  status: TeachingMaterialStatus;
  audience: TeachingMaterialAudience;
  mimeType: string;
  byteSize: number;
  originalName: string;
  href: string;
  createdAt: string;
  createdByUserId: string | null;
  ownerName: string | null;
  canEdit: boolean;
  isBook: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isPaged: boolean;
  canOpen: boolean;
  openKind: LibraryOpenKind | null;
  accessMode: LibraryAccessMode;
  downloadsRestricted: boolean;
  canDownload: boolean;
  isLocked: boolean;
  lockReason: LibraryLockReason | null;
  pageCount: number;
  readHref: string;
  downloadHref: string;
};

export type TeachingBookView = TeachingMaterialView & {
  bookKind: "pdf" | "epub" | "pptx" | "image" | "video" | "audio";
  viewKind: LibraryOpenKind;
  pages: Array<
    TeachingMaterialPage & {
      href?: string;
    }
  >;
};

function canManageLibrary(actor: ApiActor) {
  return hasAnyPermission(actor, "academic.curriculum");
}

function canUploadLibrary(actor: ApiActor) {
  return canManageLibrary(actor) || actor.roleKey === "teacher";
}

function canSeeAudience(actor: ApiActor, audience: TeachingMaterialAudience) {
  if (canManageLibrary(actor)) return true;
  if (audience === "staff") return isStaffRole(actor.roleKey);
  if (audience === "teachers") {
    return actor.roleKey === "teacher" || isStaffRole(actor.roleKey);
  }
  return (
    actor.roleKey === "student" ||
    actor.roleKey === "parent" ||
    actor.roleKey === "teacher" ||
    isStaffRole(actor.roleKey)
  );
}

async function requireReadableMaterial(
  actor: ApiActor,
  existing: {
    id: string;
    status: TeachingMaterialStatus;
    audience: TeachingMaterialAudience;
    createdByUserId: string | null;
    accessMode?: LibraryAccessMode | null;
    rentalDays?: number | null;
    isPurchasable?: boolean | null;
  } | null,
) {
  if (!existing || !canSeeMaterial(actor, existing)) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  const access = await resolveLibraryAccess(actor, [
    {
      id: existing.id,
      accessMode: existing.accessMode ?? "open",
      createdByUserId: existing.createdByUserId,
      rentalDays: existing.rentalDays,
      isPurchasable: existing.isPurchasable,
    },
  ]);
  if (access.get(existing.id)?.isLocked) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  return access.get(existing.id);
}

function canSeeMaterial(
  actor: ApiActor,
  item: {
    status: TeachingMaterialStatus;
    audience: TeachingMaterialAudience;
    createdByUserId: string | null;
  },
) {
  const owner = item.createdByUserId === actor.userId;
  if (canManageLibrary(actor) || owner) return true;
  if (item.status !== "published") return false;
  return canSeeAudience(actor, item.audience);
}

async function catalogSubjects() {
  return db
    .select({
      slug: subjects.slug,
      name: subjects.name,
    })
    .from(subjects)
    .where(eq(subjects.isEnabled, true))
    .orderBy(asc(subjects.sortOrder));
}

function toView(
  actor: ApiActor,
  row: {
    id: string;
    title: string;
    description: string | null;
    category: TeachingMaterialCategory;
    subjectSlug: string | null;
    subjectName: string | null;
    status: TeachingMaterialStatus;
    audience: TeachingMaterialAudience;
    mimeType: string;
    byteSize: number;
    originalName: string | null;
    createdAt: Date;
    createdByUserId: string | null;
    ownerName: string | null;
    pageCount: number | null;
    accessMode?: LibraryAccessMode | null;
    downloadsRestricted?: boolean | null;
  },
  access?: LibraryAccessDecision,
): TeachingMaterialView {
  const pageCount = row.pageCount ?? 0;
  const isBook =
    isLibraryBookCategory(row.category) && isLibraryBookMime(row.mimeType);
  const isVideo =
    isLibraryVideoMime(row.mimeType) || row.category === "video";
  const isAudio =
    isLibraryAudioMime(row.mimeType) || row.category === "audio";
  const openKind = libraryOpenKind(row.category, row.mimeType, pageCount);
  const downloadsRestricted = Boolean(row.downloadsRestricted);
  const canDownload =
    !access?.isLocked &&
    libraryCanDownloadFile({
      downloadsRestricted,
      canManage: canManageLibrary(actor),
      isOwner: row.createdByUserId === actor.userId,
    });
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    subjectSlug: row.subjectSlug,
    subjectName: row.subjectName,
    status: row.status,
    audience: row.audience,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    originalName: row.originalName ?? "file",
    href: libraryFileHref(row.id),
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
    ownerName: row.ownerName,
    canEdit: canManageLibrary(actor) || row.createdByUserId === actor.userId,
    isBook,
    isVideo,
    isAudio,
    isPaged: pageCount > 0,
    canOpen: openKind !== null && !access?.isLocked,
    openKind,
    accessMode: row.accessMode ?? access?.accessMode ?? "open",
    downloadsRestricted,
    canDownload,
    isLocked: access?.isLocked ?? false,
    lockReason: access?.lockReason ?? null,
    pageCount,
    readHref: libraryBookHref(row.id),
    downloadHref: libraryFileHref(row.id, true),
  };
}

async function loadMaterial(id: string) {
  const [row] = await db
    .select({
      id: teachingMaterials.id,
      title: teachingMaterials.title,
      description: teachingMaterials.description,
      category: teachingMaterials.category,
      subjectSlug: teachingMaterials.subjectSlug,
      subjectName: subjects.name,
      status: teachingMaterials.status,
      audience: teachingMaterials.audience,
      fileId: teachingMaterials.fileId,
      mimeType: files.mimeType,
      byteSize: files.byteSize,
      originalName: files.originalName,
      createdAt: teachingMaterials.createdAt,
      createdByUserId: teachingMaterials.createdByUserId,
      ownerName: users.displayName,
      pages: teachingMaterials.pages,
      pageCount: teachingMaterials.pageCount,
      accessMode: teachingMaterials.accessMode,
      rentalDays: teachingMaterials.rentalDays,
      isPurchasable: teachingMaterials.isPurchasable,
      downloadsRestricted: teachingMaterials.downloadsRestricted,
    })
    .from(teachingMaterials)
    .innerJoin(files, eq(files.id, teachingMaterials.fileId))
    .leftJoin(subjects, eq(subjects.slug, teachingMaterials.subjectSlug))
    .leftJoin(users, eq(users.id, teachingMaterials.createdByUserId))
    .where(eq(teachingMaterials.id, id))
    .limit(1);
  return row ?? null;
}

export async function listTeachingLibrary(
  actor: ApiActor,
  input: ListTeachingLibraryInput = {},
) {
  const filters = [];
  if (input.category) {
    filters.push(eq(teachingMaterials.category, input.category));
  }
  if (input.subjectSlug) {
    filters.push(eq(teachingMaterials.subjectSlug, input.subjectSlug));
  }

  const rows = await db
    .select({
      id: teachingMaterials.id,
      title: teachingMaterials.title,
      description: teachingMaterials.description,
      category: teachingMaterials.category,
      subjectSlug: teachingMaterials.subjectSlug,
      subjectName: subjects.name,
      status: teachingMaterials.status,
      audience: teachingMaterials.audience,
      mimeType: files.mimeType,
      byteSize: files.byteSize,
      originalName: files.originalName,
      createdAt: teachingMaterials.createdAt,
      createdByUserId: teachingMaterials.createdByUserId,
      ownerName: users.displayName,
      pageCount: teachingMaterials.pageCount,
      accessMode: teachingMaterials.accessMode,
      rentalDays: teachingMaterials.rentalDays,
      isPurchasable: teachingMaterials.isPurchasable,
      downloadsRestricted: teachingMaterials.downloadsRestricted,
    })
    .from(teachingMaterials)
    .innerJoin(files, eq(files.id, teachingMaterials.fileId))
    .leftJoin(subjects, eq(subjects.slug, teachingMaterials.subjectSlug))
    .leftJoin(users, eq(users.id, teachingMaterials.createdByUserId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(teachingMaterials.sortOrder), desc(teachingMaterials.createdAt))
    .limit(200);

  const visible = rows.filter((row) => canSeeMaterial(actor, row));
  const access = await resolveLibraryAccess(actor, visible);
  const canManage = canManageLibrary(actor);

  return {
    materials: visible.map((row) => toView(actor, row, access.get(row.id))),
    subjects: await catalogSubjects(),
    catalog: canManage ? await listLibraryAccessCatalog() : null,
    licences: await listLearnerLicences(actor),
    rentals: await listLearnerRentals(actor),
    subscriptions: await listLearnerSubscriptions(actor),
    purchases: await listLearnerPurchases(actor),
    courses: await listLearnerPrerecordedCourses(actor),
    canUpload: canUploadLibrary(actor),
    canManage,
  };
}

export async function createTeachingMaterial(
  actor: ApiActor,
  input: {
    title: string;
    description?: string;
    category: TeachingMaterialCategory;
    subjectSlug?: string;
    audience?: TeachingMaterialAudience;
    accessMode?: LibraryAccessMode;
    downloadsRestricted?: boolean;
    status?: TeachingMaterialStatus;
    name: string;
    mimeType: string;
    bytes: Buffer;
  },
  ip: string,
) {
  if (!canUploadLibrary(actor)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot add teaching materials");
  }

  const title = input.title.trim();
  if (title.length < 2) {
    throw new ApiError(422, "VALIDATION", "Enter a title for this material");
  }
  const name = sanitizeClassroomFileName(input.name);
  if (classroomContainsContactDetails(`${title} ${name}`)) {
    throw new ApiError(
      422,
      "CONTACT_BLOCKED",
      "Keep phone numbers and personal accounts off titles and file names",
    );
  }
  const mimeType = resolveLibraryFileType(input.mimeType, name);
  if (!mimeType) {
    throw new ApiError(422, "VALIDATION", "That file type cannot be stored in the library");
  }
  if (input.bytes.byteLength < 1) {
    throw new ApiError(422, "VALIDATION", "Choose a file to add");
  }
  if (input.bytes.byteLength > LIBRARY_MAX_FILE_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "That file is larger than 32 MB");
  }
  if (!isLibraryCategoryMime(input.category, mimeType)) {
    throw new ApiError(422, "VALIDATION", libraryMimeError(input.category));
  }

  let parsedPages: ClassroomParsedSlide[] | undefined;
  let imagePage = false;
  const maxPages =
    input.category === "presentation"
      ? LIBRARY_MAX_SLIDES
      : LIBRARY_MAX_BOOK_PAGES;
  try {
    if (isClassroomPptxType(mimeType)) {
      parsedPages = parsePptxSlides(input.bytes, maxPages);
    } else if (isClassroomEpubType(mimeType)) {
      parsedPages = parseEpubPages(input.bytes, maxPages);
    } else if (mimeType === "application/pdf") {
      parsedPages = parsePdfPages(input.bytes, maxPages);
    } else if (isLibraryImageMime(mimeType)) {
      imagePage = true;
    }
  } catch (error) {
    throw new ApiError(
      422,
      "VALIDATION",
      error instanceof Error ? error.message : "That file is not readable",
    );
  }

  const subjectSlug: string | null =
    input.subjectSlug?.trim() ||
    (isLibraryBookCategory(input.category)
      ? LIBRARY_BOOK_SUBJECT[input.category]
      : null);
  if (subjectSlug) {
    const [subject] = await db
      .select({ slug: subjects.slug })
      .from(subjects)
      .where(eq(subjects.slug, subjectSlug))
      .limit(1);
    if (!subject) {
      throw new ApiError(404, "NOT_FOUND", "Subject not found");
    }
  }

  const status: TeachingMaterialStatus =
    input.status === "published" ? "published" : "draft";
  const audience = coerceLibraryAudience(input.category, input.audience);
  const accessMode =
    input.accessMode && canManageLibrary(actor)
      ? input.accessMode
      : defaultLibraryAccessMode();
  const downloadsRestricted = Boolean(input.downloadsRestricted);
  const materialId = randomUUID();
  const fileId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(files).values({
      id: fileId,
      ownerUserId: actor.userId,
      purpose: "teaching_material",
      storageKey: `library:${materialId}:${fileId}:${name}`,
      mimeType,
      byteSize: input.bytes.byteLength,
      originalName: name,
      visibility: "restricted",
    });
    await tx.insert(fileObjects).values({
      fileId,
      content: input.bytes,
    });
    await tx.insert(teachingMaterials).values({
      id: materialId,
      title,
      description: input.description?.trim() || null,
      category: input.category,
      subjectSlug,
      fileId,
      status,
      audience,
      accessMode,
      downloadsRestricted,
      createdByUserId: actor.userId,
    });
  });

  if (parsedPages) {
    const pages = await storeLibraryBookPages(
      materialId,
      actor.userId,
      parsedPages,
    );
    await db
      .update(teachingMaterials)
      .set({ pages, pageCount: pages.length })
      .where(eq(teachingMaterials.id, materialId));
  } else if (imagePage) {
    const pages: TeachingMaterialPage[] = [
      {
        id: "page-1",
        title,
        body: input.description?.trim()
          ? [input.description.trim().slice(0, 180)]
          : [],
        imageFileId: fileId,
        dir: detectClassroomTextDirection(
          `${title} ${input.description ?? ""}`,
        ),
      },
    ];
    await db
      .update(teachingMaterials)
      .set({ pages, pageCount: 1 })
      .where(eq(teachingMaterials.id, materialId));
  }

  await writeAuditLog({
    actor,
    action: "library.material_created",
    entityType: "teaching_material",
    entityId: materialId,
    ipAddress: ip,
    metadata: { category: input.category, status, audience },
  });

  const saved = await loadMaterial(materialId);
  if (!saved) {
    throw new ApiError(500, "INTERNAL", "Could not save the teaching material");
  }
  return toView(actor, saved);
}

export async function updateTeachingMaterial(
  actor: ApiActor,
  id: string,
  input: UpdateTeachingMaterialInput,
  ip: string,
) {
  const existing = await loadMaterial(id);
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  if (!canManageLibrary(actor) && existing.createdByUserId !== actor.userId) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change this material");
  }

  const nextCategory = input.category ?? existing.category;
  const audience = coerceLibraryAudience(
    nextCategory,
    input.audience ?? existing.audience,
  );

  let subjectSlug = existing.subjectSlug;
  if (input.subjectSlug !== undefined) {
    const next = input.subjectSlug.trim();
    if (!next) {
      subjectSlug = null;
    } else {
      const [subject] = await db
        .select({ slug: subjects.slug })
        .from(subjects)
        .where(eq(subjects.slug, next))
        .limit(1);
      if (!subject) {
        throw new ApiError(404, "NOT_FOUND", "Subject not found");
      }
      subjectSlug = subject.slug;
    }
  }

  const [updated] = await db
    .update(teachingMaterials)
    .set({
      ...(input.title ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() || null }
        : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.subjectSlug !== undefined ? { subjectSlug } : {}),
      ...(input.status ? { status: input.status } : {}),
      audience,
      ...(input.accessMode && canManageLibrary(actor)
        ? { accessMode: input.accessMode }
        : {}),
      ...(input.downloadsRestricted !== undefined
        ? { downloadsRestricted: input.downloadsRestricted }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    })
    .where(eq(teachingMaterials.id, id))
    .returning({ id: teachingMaterials.id });

  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }

  await writeAuditLog({
    actor,
    action: "library.material_updated",
    entityType: "teaching_material",
    entityId: id,
    ipAddress: ip,
    metadata: input,
  });

  const saved = await loadMaterial(id);
  if (!saved) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  return toView(actor, saved);
}

export async function deleteTeachingMaterial(
  actor: ApiActor,
  id: string,
  ip: string,
) {
  const existing = await loadMaterial(id);
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  if (!canManageLibrary(actor) && existing.createdByUserId !== actor.userId) {
    throw new ApiError(403, "FORBIDDEN", "You cannot remove this material");
  }

  await db.delete(files).where(like(files.storageKey, `library:${id}:%`));

  await writeAuditLog({
    actor,
    action: "library.material_deleted",
    entityType: "teaching_material",
    entityId: id,
    ipAddress: ip,
  });

  return { id };
}

export async function downloadTeachingMaterial(
  actor: ApiActor,
  id: string,
  input: { download?: string } = {},
) {
  const existing = await loadMaterial(id);
  await requireReadableMaterial(actor, existing);
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }

  const asDownload = ["1", "true", "yes"].includes(
    (input.download ?? "").toLowerCase(),
  );
  const canDownload = libraryCanDownloadFile({
    downloadsRestricted: existing.downloadsRestricted,
    canManage: canManageLibrary(actor),
    isOwner: existing.createdByUserId === actor.userId,
  });
  const streamOnly =
    (existing.mimeType.startsWith("video/") ||
      existing.mimeType.startsWith("audio/")) &&
    !asDownload;
  if (!canDownload && (asDownload || !streamOnly)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Downloads are restricted for this material",
    );
  }

  const [object] = await db
    .select({ content: fileObjects.content })
    .from(fileObjects)
    .where(eq(fileObjects.fileId, existing.fileId))
    .limit(1);
  if (!object) {
    throw new ApiError(404, "NOT_FOUND", "That file is no longer stored");
  }

  const name = existing.originalName?.trim() || "file";
  const encoded = encodeURIComponent(name);
  const attach =
    asDownload || libraryFileNeedsDownload(existing.mimeType);
  return new Response(new Uint8Array(object.content), {
    headers: {
      "Content-Type": existing.mimeType,
      "Content-Length": String(object.content.byteLength),
      "Content-Disposition": `${
        attach ? "attachment" : "inline"
      }; filename="${asciiDownloadName(name)}"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

async function storeLibraryBookPages(
  materialId: string,
  ownerUserId: string,
  parsed: ClassroomParsedSlide[],
) {
  const pages: TeachingMaterialPage[] = [];
  for (const [index, slide] of parsed.entries()) {
    let imageFileId: string | undefined;
    if (slide.image) {
      imageFileId = randomUUID();
      const imageName = sanitizeClassroomFileName(slide.image.name);
      await db.insert(files).values({
        id: imageFileId,
        ownerUserId,
        purpose: "teaching_material",
        storageKey: `library:${materialId}:page:${imageFileId}:${imageName}`,
        mimeType: slide.image.mimeType,
        byteSize: slide.image.bytes.byteLength,
        originalName: imageName,
        visibility: "restricted",
      });
      await db.insert(fileObjects).values({
        fileId: imageFileId,
        content: slide.image.bytes,
      });
    }
    pages.push({
      id: `page-${index + 1}`,
      title: slide.title,
      body: slide.body,
      imageFileId,
      dir: slide.dir,
    });
  }
  return pages;
}

export async function getTeachingBook(actor: ApiActor, id: string) {
  const existing = await loadMaterial(id);
  const access = await requireReadableMaterial(actor, existing);
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  const viewKind = libraryOpenKind(
    existing.category,
    existing.mimeType,
    existing.pageCount ?? 0,
  );
  if (!viewKind) {
    throw new ApiError(
      404,
      "NOT_FOUND",
      "That item cannot be opened in the library",
    );
  }
  const pages = existing.pages ?? [];
  const bookKind =
    viewKind === "audio"
      ? "audio"
      : viewKind === "video"
        ? "video"
      : isClassroomPptxType(existing.mimeType)
        ? "pptx"
        : isLibraryImageMime(existing.mimeType)
          ? "image"
          : isClassroomEpubType(existing.mimeType)
            ? "epub"
            : "pdf";
  return {
    ...toView(actor, existing, access),
    bookKind,
    viewKind,
    pages: pages.map((page) => ({
      ...page,
      href: page.imageFileId
        ? libraryBookPageHref(existing.id, page.imageFileId)
        : undefined,
    })),
  } satisfies TeachingBookView;
}

export async function downloadTeachingBookPage(
  actor: ApiActor,
  id: string,
  pageId: string,
) {
  const existing = await loadMaterial(id);
  await requireReadableMaterial(actor, existing);
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  const page = (existing.pages ?? []).find((item) => item.imageFileId === pageId);
  if (!page?.imageFileId) {
    throw new ApiError(404, "NOT_FOUND", "That book page is not stored");
  }
  const [object] = await db
    .select({
      content: fileObjects.content,
      mimeType: files.mimeType,
      originalName: files.originalName,
    })
    .from(fileObjects)
    .innerJoin(files, eq(files.id, fileObjects.fileId))
    .where(eq(fileObjects.fileId, page.imageFileId))
    .limit(1);
  if (!object) {
    throw new ApiError(404, "NOT_FOUND", "That book page is not stored");
  }
  const name = object.originalName?.trim() || "page";
  return new Response(new Uint8Array(object.content), {
    headers: {
      "Content-Type": object.mimeType,
      "Content-Length": String(object.content.byteLength),
      "Content-Disposition": `inline; filename="${asciiDownloadName(name)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}


