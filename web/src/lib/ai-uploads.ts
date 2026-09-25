import { classroomContainsContactDetails } from "@/lib/classroom";
import { sanitizeClassroomFileName } from "@/lib/classroom-files";
import { parseEpubPages } from "@/lib/classroom-epub";
import { parsePdfPages } from "@/lib/classroom-pdf";
import {
  CLASSROOM_MAX_SLIDES,
  CLASSROOM_PPTX_MIME,
  parsePptxSlides,
  type ClassroomParsedSlide,
} from "@/lib/classroom-pptx";
import { unzipClassroomArchive } from "@/lib/classroom-zip";

export const AI_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const AI_UPLOAD_DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const AI_UPLOAD_TYPES: Record<string, string[]> = {
  "text/plain": [".txt"],
  "application/pdf": [".pdf"],
  [AI_UPLOAD_DOCX_MIME]: [".docx"],
  [CLASSROOM_PPTX_MIME]: [".pptx"],
  "application/epub+zip": [".epub"],
};

export function aiUploadAccept() {
  return Object.keys(AI_UPLOAD_TYPES).join(",");
}

export function resolveAiUploadType(mime: string, name: string) {
  const lower = mime.toLowerCase().trim();
  if (AI_UPLOAD_TYPES[lower]) return lower;
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  for (const [type, exts] of Object.entries(AI_UPLOAD_TYPES)) {
    if (exts.includes(ext)) return type;
  }
  return null;
}

export function sanitizeAiUploadName(name: string) {
  return sanitizeClassroomFileName(name);
}

export function extractUploadedDocumentText(
  bytes: Buffer,
  mime: string,
  name: string,
) {
  if (bytes.byteLength < 1) {
    throw new Error("Choose a document with readable text");
  }
  if (classroomContainsContactDetails(name)) {
    throw new Error("Keep phone numbers and personal accounts off file names");
  }
  let text = "";
  if (mime === "text/plain") {
    text = bytes.toString("utf8");
  } else if (mime === "application/pdf") {
    text = pagesToText(parsePdfPages(bytes, CLASSROOM_MAX_SLIDES));
  } else if (mime === CLASSROOM_PPTX_MIME) {
    text = pagesToText(parsePptxSlides(bytes, CLASSROOM_MAX_SLIDES));
  } else if (mime === "application/epub+zip") {
    text = pagesToText(parseEpubPages(bytes, CLASSROOM_MAX_SLIDES));
  } else if (mime === AI_UPLOAD_DOCX_MIME) {
    text = extractDocxText(bytes);
  } else {
    throw new Error("That document type has no readable text");
  }
  const cleaned = cleanDocumentText(text);
  if (cleaned.length < 20) {
    throw new Error("That document has no readable text for a quiz");
  }
  return cleaned;
}

function pagesToText(pages: ClassroomParsedSlide[]) {
  return pages.flatMap((page) => [page.title, ...page.body]).join("\n");
}

function extractDocxText(bytes: Buffer) {
  const archive = unzipClassroomArchive(bytes, "That Word file is not readable");
  const xml = archive.get("word/document.xml")?.toString("utf8");
  if (!xml) {
    throw new Error("That Word file has no readable text");
  }
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, " ")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    );
}

function cleanDocumentText(value: string) {
  const lines = value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !classroomContainsContactDetails(line));
  return lines.join(" ").replace(/\s+/g, " ").trim().slice(0, 20000);
}
