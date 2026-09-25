import { classroomContainsContactDetails } from "@/lib/classroom";
import {
  CLASSROOM_MAX_SLIDE_IMAGE_BYTES,
  CLASSROOM_MAX_SLIDES,
  type ClassroomParsedSlide,
} from "@/lib/classroom-pptx";
import { detectClassroomTextDirection } from "@/lib/classroom-whiteboard";
import { normalizeZipPath, resolveZipPath, unzipClassroomArchive } from "@/lib/classroom-zip";

export const CLASSROOM_EPUB_MIME = "application/epub+zip";

export function isClassroomEpubType(mime: string) {
  return mime === CLASSROOM_EPUB_MIME;
}

export function parseEpubPages(
  bytes: Buffer,
  maxPages = CLASSROOM_MAX_SLIDES,
): ClassroomParsedSlide[] {
  const archive = unzipClassroomArchive(bytes, "That digital book is not a valid EPUB");
  const container = archive.get("META-INF/container.xml")?.toString("utf8");
  if (!container) {
    throw new Error("That digital book is missing its contents list");
  }
  const opfPath = container.match(/\bfull-path="([^"]+)"/)?.[1];
  if (!opfPath) {
    throw new Error("That digital book is missing its contents list");
  }
  const opf = archive.get(normalizeZipPath(opfPath))?.toString("utf8");
  if (!opf) {
    throw new Error("That digital book has no readable chapters");
  }
  const baseDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/")) : "";
  const manifest = parseManifest(opf);
  const spine = parseSpine(opf);
  const slides: ClassroomParsedSlide[] = [];
  for (const id of spine) {
    const item = manifest.get(id);
    if (!item || !isHtml(item.type, item.href)) continue;
    const path = resolveZipPath(baseDir, item.href);
    const html = archive.get(path)?.toString("utf8");
    if (!html) continue;
    const slide = readChapter(html, path, archive, slides.length);
    if (slide) slides.push(slide);
    if (slides.length >= maxPages) break;
  }
  if (!slides.length) {
    throw new Error("That digital book has no readable pages");
  }
  return slides;
}

function parseManifest(opf: string) {
  const map = new Map<string, { href: string; type: string }>();
  const block = opf.match(/<manifest\b[^>]*>([\s\S]*?)<\/manifest>/i)?.[1] ?? opf;
  const pattern = /<item\b[^>]*>/gi;
  let match = pattern.exec(block);
  while (match) {
    const tag = match[0];
    const id = attr(tag, "id");
    const href = attr(tag, "href");
    const type = attr(tag, "media-type") || attr(tag, "media-type".replace("-", ""));
    if (id && href) {
      map.set(id, { href: decodeXml(href), type: type.toLowerCase() });
    }
    match = pattern.exec(block);
  }
  return map;
}

function parseSpine(opf: string) {
  const block = opf.match(/<spine\b[^>]*>([\s\S]*?)<\/spine>/i)?.[1] ?? "";
  return [...block.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/gi)].map((item) => item[1]);
}

function readChapter(
  html: string,
  path: string,
  archive: Map<string, Buffer>,
  index: number,
): ClassroomParsedSlide | null {
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  const heading = firstTagText(stripped, "h1") || firstTagText(stripped, "h2") || firstTagText(stripped, "title");
  const paragraphs = tagTexts(stripped, "p");
  const titles = tagTexts(stripped, "h3");
  const lines = [...paragraphs, ...titles]
    .map(sanitizeLine)
    .filter((line): line is string => Boolean(line));
  const title = sanitizeLine(heading || "") || lines[0] || `Page ${index + 1}`;
  const body = (heading ? lines : lines.slice(1)).slice(0, 12);
  const dir = detectClassroomTextDirection([title, ...body].join(" "), htmlDir(stripped));
  const image = chapterImage(stripped, path, archive);
  if (!title && !body.length && !image) return null;
  return { title, body, dir, image };
}

function chapterImage(html: string, path: string, archive: Map<string, Buffer>) {
  const src = html.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1];
  if (!src || src.startsWith("http") || src.startsWith("data:")) return undefined;
  const baseDir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const mediaPath = resolveZipPath(baseDir, decodeXml(src));
  const bytes = archive.get(mediaPath);
  const mime = imageMime(mediaPath);
  if (!bytes || !mime || bytes.byteLength < 24) return undefined;
  if (bytes.byteLength > CLASSROOM_MAX_SLIDE_IMAGE_BYTES) return undefined;
  return { name: mediaPath.split("/").pop() || "page.png", mimeType: mime, bytes };
}

function imageMime(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return undefined;
}

function isHtml(type: string, href: string) {
  if (type.includes("html") || type.includes("xml")) return true;
  return /\.(xhtml|html|htm|xml)$/i.test(href);
}

function firstTagText(html: string, tag: string) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXml(stripTags(match[1])) : "";
}

function tagTexts(html: string, tag: string) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return [...html.matchAll(pattern)].map((item) => decodeXml(stripTags(item[1] ?? "")));
}

function htmlDir(html: string): "ltr" | "rtl" {
  if (/\bdir\s*=\s*["']rtl["']/i.test(html.slice(0, 800))) return "rtl";
  return "ltr";
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeLine(value: string) {
  const text = value.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!text || classroomContainsContactDetails(text)) return "";
  return text;
}

function attr(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? "";
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => fromCodePoint(Number(code)))
    .replace(/&nbsp;/g, " ")
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
