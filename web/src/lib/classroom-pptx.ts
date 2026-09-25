import type {
  ClassroomPresentation,
  ClassroomPresentationSlide,
  ClassroomWhiteboardDocument,
} from "@/db/schema/classrooms";
import { classroomContainsContactDetails } from "@/lib/classroom";
import {
  detectClassroomTextDirection,
  parseWhiteboardPage,
} from "@/lib/classroom-whiteboard";
import { resolveZipPath, unzipClassroomArchive } from "@/lib/classroom-zip";

export const CLASSROOM_MAX_SLIDES = 40;
export const CLASSROOM_MAX_BOOKMARKS = 16;
export const CLASSROOM_MAX_SLIDE_IMAGE_BYTES = 2 * 1024 * 1024;
export const CLASSROOM_PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export type ClassroomParsedSlide = {
  title: string;
  body: string[];
  dir: "ltr" | "rtl";
  image?: { name: string; mimeType: string; bytes: Buffer };
};

const SLIDE_IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function isClassroomPptxType(mime: string) {
  return mime === CLASSROOM_PPTX_MIME;
}

export function isClassroomPresentableType(mime: string) {
  return (
    mime === CLASSROOM_PPTX_MIME ||
    mime === "application/pdf" ||
    mime === "application/epub+zip"
  );
}

export function parseClassroomPresentation(value: unknown): ClassroomPresentation | null {
  if (!value || typeof value !== "object") return null;
  const item = value as {
    fileId?: unknown;
    name?: unknown;
    kind?: unknown;
    slideIndex?: unknown;
    open?: unknown;
    slides?: unknown;
    bookmarks?: unknown;
    followLocked?: unknown;
  };
  if (typeof item.fileId !== "string" || typeof item.name !== "string") return null;
  if (item.kind !== "pptx" && item.kind !== "pdf" && item.kind !== "epub") return null;
  if (!Array.isArray(item.slides)) return null;
  const slides = item.slides
    .map((slide, index) => parseSlide(slide, index))
    .filter((slide): slide is ClassroomPresentationSlide => Boolean(slide))
    .slice(0, CLASSROOM_MAX_SLIDES);
  if (!slides.length) return null;
  const slideIndex =
    typeof item.slideIndex === "number" && Number.isInteger(item.slideIndex)
      ? Math.max(0, Math.min(slides.length - 1, item.slideIndex))
      : 0;
  return {
    fileId: item.fileId,
    name: item.name.slice(0, 120) || (item.kind === "pptx" ? "Presentation" : "Book"),
    kind: item.kind,
    slideIndex,
    open: item.open === true,
    slides,
    bookmarks: parseClassroomBookmarks(item.bookmarks, slides.length),
    followLocked: item.followLocked !== false,
  };
}

export function parseClassroomBookmarks(value: unknown, slideCount: number) {
  if (!Array.isArray(value) || slideCount <= 0) return [];
  const seen = new Set<number>();
  const bookmarks: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isInteger(item)) continue;
    if (item < 0 || item >= slideCount || seen.has(item)) continue;
    seen.add(item);
    bookmarks.push(item);
    if (bookmarks.length >= CLASSROOM_MAX_BOOKMARKS) break;
  }
  return bookmarks.sort((left, right) => left - right);
}

export function toggleClassroomBookmark(deck: ClassroomPresentation, slideIndex: number) {
  const index = Math.max(0, Math.min(deck.slides.length - 1, slideIndex));
  const current = deck.bookmarks ?? [];
  if (current.includes(index)) {
    return current.filter((item) => item !== index);
  }
  if (current.length >= CLASSROOM_MAX_BOOKMARKS) return current;
  return [...current, index].sort((left, right) => left - right);
}

export function classroomPresentationSlideIds(deck: ClassroomPresentation | null) {
  if (!deck) return [];
  return deck.slides
    .map((slide) => slide.imageFileId)
    .filter((id): id is string => Boolean(id));
}

export function presentationAsBoard(
  deck: ClassroomPresentation,
  studentsCanAnnotate = true,
  viewIndex = deck.slideIndex,
): ClassroomWhiteboardDocument {
  const current =
    deck.slides[viewIndex] ?? deck.slides[deck.slideIndex] ?? deck.slides[0];
  return {
    pages: deck.slides.map((slide) => ({
      id: slide.id,
      strokes: slide.strokes ?? [],
      undo: slide.undo ?? [],
      redo: slide.redo ?? [],
    })),
    studentsCanAnnotate,
    followPageId: current?.id,
  };
}

export function boardOntoPresentation(
  deck: ClassroomPresentation,
  board: ClassroomWhiteboardDocument,
): ClassroomPresentation {
  const pages = new Map(board.pages.map((page) => [page.id, page]));
  return {
    ...deck,
    slides: deck.slides.map((slide) => {
      const page = pages.get(slide.id);
      if (!page) return slide;
      return {
        ...slide,
        strokes: page.strokes,
        undo: page.undo,
        redo: page.redo,
      };
    }),
  };
}

export function parsePptxSlides(
  bytes: Buffer,
  maxPages = CLASSROOM_MAX_SLIDES,
): ClassroomParsedSlide[] {
  const archive = unzipClassroomArchive(
    bytes,
    "That PowerPoint file is not a valid presentation archive",
  );
  const presentation = archive.get("ppt/presentation.xml");
  const rels = archive.get("ppt/_rels/presentation.xml.rels");
  if (!presentation || !rels) {
    throw new Error("That PowerPoint file has no readable slides");
  }
  const relMap = relationshipMap(rels.toString("utf8"));
  const slides: ClassroomParsedSlide[] = [];
  const limit = Math.max(1, maxPages);
  for (const relId of slideRelIds(presentation.toString("utf8"))) {
    const target = relMap.get(relId);
    if (!target) continue;
    const path = resolveZipPath("ppt", target);
    const xml = archive.get(path);
    if (!xml) continue;
    const slide = readSlide(xml.toString("utf8"), path, archive);
    if (slide) slides.push(slide);
    if (slides.length >= limit) break;
  }
  if (!slides.length) {
    throw new Error("That PowerPoint file has no readable slides");
  }
  return slides;
}

function parseSlide(value: unknown, index: number): ClassroomPresentationSlide | null {
  if (!value || typeof value !== "object") return null;
  const item = value as {
    id?: unknown;
    title?: unknown;
    body?: unknown;
    imageFileId?: unknown;
    dir?: unknown;
    strokes?: unknown;
    undo?: unknown;
    redo?: unknown;
  };
  const title =
    typeof item.title === "string" && item.title.trim()
      ? item.title.trim().slice(0, 160)
      : `Slide ${index + 1}`;
  const body = Array.isArray(item.body)
    ? item.body
        .filter((line): line is string => typeof line === "string" && Boolean(line.trim()))
        .map((line) => line.trim().slice(0, 180))
        .slice(0, 12)
    : [];
  const marks = parseWhiteboardPage({
    id:
      typeof item.id === "string" && item.id.trim()
        ? item.id.trim().slice(0, 80)
        : `slide-${index + 1}`,
    strokes: item.strokes,
    undo: item.undo,
    redo: item.redo,
  });
  return {
    id: marks?.id ?? `slide-${index + 1}`,
    title,
    body,
    imageFileId:
      typeof item.imageFileId === "string" && item.imageFileId
        ? item.imageFileId
        : undefined,
    dir: item.dir === "rtl" || item.dir === "ltr" ? item.dir : undefined,
    strokes: marks?.strokes,
    undo: marks?.undo,
    redo: marks?.redo,
  };
}

function slideRelIds(xml: string) {
  const ids: string[] = [];
  const list = xml.match(/<p:sldIdLst\b[\s\S]*?<\/p:sldIdLst>/);
  const source = list?.[0] ?? xml;
  const pattern = /<p:sldId\b[^>]*\br:id="([^"]+)"/g;
  let match = pattern.exec(source);
  while (match) {
    if (match[1]) ids.push(match[1]);
    match = pattern.exec(source);
  }
  return ids;
}

function relationshipMap(xml: string) {
  const map = new Map<string, string>();
  const pattern = /<Relationship\b[^>]*>/g;
  let match = pattern.exec(xml);
  while (match) {
    const tag = match[0];
    const id = tag.match(/\bId="([^"]+)"/)?.[1];
    const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target && !target.startsWith("http")) {
      map.set(id, decodeXml(target));
    }
    match = pattern.exec(xml);
  }
  return map;
}

function readSlide(xml: string, path: string, archive: Map<string, Buffer>): ClassroomParsedSlide | null {
  if (/\bshow="0"/.test(xml.slice(0, 240))) return null;
  const texts = xmlTexts(xml)
    .map(sanitizeSlideLine)
    .filter((line): line is string => Boolean(line));
  const title = texts[0] || fallbackSlideTitle(path);
  const body = texts.slice(1, 13);
  const dir = detectClassroomTextDirection([title, ...body].join(" "));
  const image = slideImage(path, xml, archive);
  return { title, body, dir, image };
}

function xmlTexts(xml: string) {
  const texts: string[] = [];
  const pattern = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
  let match = pattern.exec(xml);
  while (match) {
    const text = decodeXml(match[1] ?? "");
    if (text) texts.push(text);
    match = pattern.exec(xml);
  }
  return texts;
}

function slideImage(path: string, xml: string, archive: Map<string, Buffer>) {
  const relPath = `${path.replace(/[^/]+$/, "")}_rels/${path.split("/").pop()}.rels`;
  const rels = archive.get(relPath);
  if (!rels) return undefined;
  const relMap = relationshipMap(rels.toString("utf8"));
  const embeds = [...xml.matchAll(/<a:blip\b[^>]*\br:embed="([^"]+)"/g)].map((item) => item[1]);
  const baseDir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  let chosen: ClassroomParsedSlide["image"];
  for (const embed of embeds) {
    const target = embed ? relMap.get(embed) : undefined;
    if (!target) continue;
    const mediaPath = resolveZipPath(baseDir, target);
    const bytes = archive.get(mediaPath);
    const mime = slideImageMime(mediaPath);
    if (!bytes || !mime || bytes.byteLength < 24) continue;
    if (bytes.byteLength > CLASSROOM_MAX_SLIDE_IMAGE_BYTES) continue;
    if (!chosen || bytes.byteLength > chosen.bytes.byteLength) {
      chosen = {
        name: mediaPath.split("/").pop() || "slide.png",
        mimeType: mime,
        bytes,
      };
    }
  }
  return chosen;
}

function slideImageMime(path: string) {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot).toLowerCase() : "";
  return SLIDE_IMAGE_TYPES[ext];
}

function sanitizeSlideLine(value: string) {
  const text = value.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!text || classroomContainsContactDetails(text)) return "";
  return text;
}

function fallbackSlideTitle(path: string) {
  const match = path.match(/slide(\d+)/i);
  return `Slide ${match?.[1] ?? ""}`.trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function fromCodePoint(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 0x10ffff) return "";
  return String.fromCodePoint(value);
}
