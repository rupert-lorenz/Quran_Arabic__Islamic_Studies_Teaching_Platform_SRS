import { inflateRawSync, inflateSync } from "node:zlib";
import { classroomContainsContactDetails } from "@/lib/classroom";
import {
  CLASSROOM_MAX_SLIDE_IMAGE_BYTES,
  CLASSROOM_MAX_SLIDES,
  type ClassroomParsedSlide,
} from "@/lib/classroom-pptx";
import { detectClassroomTextDirection } from "@/lib/classroom-whiteboard";

type PdfObject = {
  num: number;
  dict: string;
  stream?: Buffer;
};

export function parsePdfPages(
  bytes: Buffer,
  maxPages = CLASSROOM_MAX_SLIDES,
): ClassroomParsedSlide[] {
  if (bytes.byteLength < 8 || bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("That PDF is not readable");
  }
  const latin = bytes.toString("latin1");
  const objects = parsePdfObjects(bytes, latin);
  const pageNums = collectPageNumbers(objects);
  if (!pageNums.length) {
    throw new Error("That PDF has no readable pages");
  }
  const jpegs = extractJpegStreams(objects);
  const slides: ClassroomParsedSlide[] = [];
  for (let index = 0; index < Math.min(pageNums.length, maxPages); index += 1) {
    const page = objects.get(pageNums[index] ?? -1);
    const texts = page ? extractPageText(page, objects) : [];
    const title = texts[0] || `Page ${index + 1}`;
    const body = texts.slice(1, 13);
    const image = pageImage(page, objects, jpegs, index);
    const dir = detectClassroomTextDirection([title, ...body].join(" "));
    slides.push({ title, body, dir, image });
  }
  if (!slides.length) {
    throw new Error("That PDF has no readable pages");
  }
  return slides;
}

function parsePdfObjects(bytes: Buffer, latin: string) {
  const objects = new Map<number, PdfObject>();
  const pattern = /(\d+)\s+\d+\s+obj\b/g;
  let match = pattern.exec(latin);
  while (match) {
    const num = Number(match[1]);
    const start = match.index + match[0].length;
    const end = latin.indexOf("endobj", start);
    if (end < 0) break;
    const body = latin.slice(start, end);
    const streamMatch = /\bstream(?:\r\n|\n|\r)/.exec(body);
    let dict = body;
    let stream: Buffer | undefined;
    if (streamMatch && streamMatch.index != null) {
      dict = body.slice(0, streamMatch.index);
      const streamStart = start + streamMatch.index + streamMatch[0].length;
      const declared = dict.match(/\/Length\s+(\d+)\b/);
      const endStream = latin.indexOf("endstream", streamStart);
      const untilEnd = endStream >= 0 ? Math.max(0, endStream - streamStart) : 0;
      const length = declared ? Number(declared[1]) : untilEnd;
      if (streamStart >= 0 && length > 0 && streamStart + length <= bytes.byteLength) {
        stream = Buffer.from(bytes.subarray(streamStart, streamStart + length));
      }
    }
    objects.set(num, { num, dict, stream });
    pattern.lastIndex = end + 6;
    match = pattern.exec(latin);
  }
  return objects;
}

function collectPageNumbers(objects: Map<number, PdfObject>) {
  const catalog = [...objects.values()].find((item) => /\/Type\s*\/Catalog\b/.test(item.dict));
  const rootPages = catalog ? firstRef(catalog.dict, "Pages") : undefined;
  const ordered: number[] = [];
  const seen = new Set<number>();
  function walk(num: number | undefined) {
    if (num == null || seen.has(num)) return;
    seen.add(num);
    const item = objects.get(num);
    if (!item) return;
    if (/\/Type\s*\/Page\b/.test(item.dict) && !/\/Type\s*\/Pages\b/.test(item.dict)) {
      ordered.push(num);
      return;
    }
    for (const kid of arrayRefs(item.dict, "Kids")) walk(kid);
  }
  walk(rootPages);
  if (ordered.length) return ordered;
  return [...objects.values()]
    .filter((item) => /\/Type\s*\/Page\b/.test(item.dict) && !/\/Type\s*\/Pages\b/.test(item.dict))
    .map((item) => item.num);
}

function pageImage(
  page: PdfObject | undefined,
  objects: Map<number, PdfObject>,
  jpegs: Buffer[],
  index: number,
): ClassroomParsedSlide["image"] {
  if (page) {
    for (const ref of resourceImageRefs(page.dict, objects)) {
      const image = asSlideImage(objects.get(ref)?.stream, `page-${index + 1}.jpg`);
      if (image) return image;
    }
  }
  const fallback = jpegs[index];
  return asSlideImage(fallback, `page-${index + 1}.jpg`);
}

function resourceImageRefs(dict: string, objects: Map<number, PdfObject>) {
  const refs: number[] = [];
  const xobject = dict.match(/\/XObject\s*<<([^>]*)>>/);
  if (xobject?.[1]) {
    const pattern = /\/[^\s\/<>]+\s+(\d+)\s+\d+\s+R/g;
    let match = pattern.exec(xobject[1]);
    while (match) {
      refs.push(Number(match[1]));
      match = pattern.exec(xobject[1]);
    }
  }
  const extra = [...dict.matchAll(/\/Im\d+\s+(\d+)\s+\d+\s+R/g)].map((item) => Number(item[1]));
  const unique = [...new Set([...refs, ...extra])];
  return unique.filter((num) => {
    const item = objects.get(num);
    return item && (/\/Subtype\s*\/Image\b/.test(item.dict) || isJpeg(item.stream));
  });
}

function extractPageText(page: PdfObject, objects: Map<number, PdfObject>) {
  const contentRefs = [
    ...arrayRefs(page.dict, "Contents"),
    ...singleRefs(page.dict, "Contents"),
  ];
  const chunks: string[] = [];
  for (const ref of contentRefs) {
    const item = objects.get(ref);
    if (!item?.stream) continue;
    const decoded = decodePdfStream(item);
    if (decoded) chunks.push(decoded.toString("latin1"));
  }
  if (!chunks.length && page.stream) {
    const decoded = decodePdfStream(page);
    if (decoded) chunks.push(decoded.toString("latin1"));
  }
  const lines: string[] = [];
  for (const chunk of chunks) {
    for (const line of pdfTextStrings(chunk)) {
      const cleaned = sanitizeLine(line);
      if (cleaned && !lines.includes(cleaned)) lines.push(cleaned);
      if (lines.length >= 14) return lines;
    }
  }
  return lines;
}

function extractJpegStreams(objects: Map<number, PdfObject>) {
  const images: Buffer[] = [];
  for (const item of objects.values()) {
    if (!item.stream || !isJpeg(item.stream)) continue;
    if (item.stream.byteLength > CLASSROOM_MAX_SLIDE_IMAGE_BYTES) continue;
    images.push(item.stream);
  }
  return images;
}

function asSlideImage(stream: Buffer | undefined, name: string): ClassroomParsedSlide["image"] {
  if (!stream || !isJpeg(stream)) return undefined;
  if (stream.byteLength < 24 || stream.byteLength > CLASSROOM_MAX_SLIDE_IMAGE_BYTES) {
    return undefined;
  }
  return { name, mimeType: "image/jpeg", bytes: stream };
}

function decodePdfStream(item: PdfObject) {
  if (!item.stream) return undefined;
  if (!/\/FlateDecode\b/.test(item.dict)) return item.stream;
  try {
    return inflateSync(item.stream);
  } catch {
    try {
      return inflateRawSync(item.stream);
    } catch {
      return undefined;
    }
  }
}

function pdfTextStrings(content: string) {
  const texts: string[] = [];
  const literal = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let match = literal.exec(content);
  while (match) {
    texts.push(decodePdfLiteral(match[0].slice(1, match[0].lastIndexOf(")"))));
    match = literal.exec(content);
  }
  const arrays = /\[(?:[^\]]*)\]\s*TJ/g;
  let block = arrays.exec(content);
  while (block) {
    const parts = [...block[0].matchAll(/\((?:\\.|[^\\)])*\)/g)].map((item) =>
      decodePdfLiteral(item[0].slice(1, -1)),
    );
    if (parts.join("").trim()) texts.push(parts.join(""));
    block = arrays.exec(content);
  }
  return texts;
}

function decodePdfLiteral(value: string) {
  return value
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{1,3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeLine(value: string) {
  const text = value.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!text || classroomContainsContactDetails(text)) return "";
  return text;
}

function firstRef(dict: string, key: string) {
  const match = dict.match(new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`));
  return match ? Number(match[1]) : undefined;
}

function singleRefs(dict: string, key: string) {
  const value = firstRef(dict, key);
  return value == null ? [] : [value];
}

function arrayRefs(dict: string, key: string) {
  const match = dict.match(new RegExp(`/${key}\\s*\\[([^\\]]*)\\]`));
  if (!match?.[1]) return [];
  return [...match[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((item) => Number(item[1]));
}

function isJpeg(bytes?: Buffer) {
  return Boolean(bytes && bytes.byteLength > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff);
}
