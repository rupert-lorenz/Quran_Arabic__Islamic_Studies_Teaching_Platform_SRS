import { inflateRawSync } from "node:zlib";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

export function unzipClassroomArchive(
  bytes: Buffer,
  invalidMessage = "That file is not a valid zip archive",
) {
  if (bytes.byteLength < 22) {
    throw new Error(invalidMessage);
  }
  const eocd = findEndOfCentralDirectory(bytes, invalidMessage);
  const count = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.byteLength || bytes.readUInt32LE(offset) !== CENTRAL_SIG) {
      throw new Error(invalidMessage);
    }
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const nameLen = bytes.readUInt16LE(offset + 28);
    const extraLen = bytes.readUInt16LE(offset + 30);
    const commentLen = bytes.readUInt16LE(offset + 32);
    const localOff = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLen).toString("utf8");
    files.set(
      normalizeZipPath(name),
      readZipEntry(bytes, localOff, method, compressed, invalidMessage),
    );
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function findEndOfCentralDirectory(bytes: Buffer, invalidMessage: string) {
  const start = Math.max(0, bytes.byteLength - 22 - 0xffff);
  for (let index = bytes.byteLength - 22; index >= start; index -= 1) {
    if (bytes.readUInt32LE(index) === EOCD_SIG) return index;
  }
  throw new Error(invalidMessage);
}

function readZipEntry(
  bytes: Buffer,
  localOff: number,
  method: number,
  compressed: number,
  invalidMessage = "That file is not a valid zip archive",
) {
  if (localOff + 30 > bytes.byteLength || bytes.readUInt32LE(localOff) !== LOCAL_SIG) {
    throw new Error(invalidMessage);
  }
  const nameLen = bytes.readUInt16LE(localOff + 26);
  const extraLen = bytes.readUInt16LE(localOff + 28);
  const dataStart = localOff + 30 + nameLen + extraLen;
  const data = bytes.subarray(dataStart, dataStart + compressed);
  if (method === 0) return Buffer.from(data);
  if (method === 8) {
    try {
      return inflateRawSync(data);
    } catch {
      throw new Error(invalidMessage);
    }
  }
  throw new Error(invalidMessage);
}

export function normalizeZipPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function resolveZipPath(baseDir: string, target: string) {
  const cleaned = target.split("?")[0]?.split("#")[0] ?? target;
  if (cleaned.startsWith("/")) return normalizeZipPath(cleaned);
  const parts = [...baseDir.split("/").filter(Boolean), ...cleaned.split("/")];
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  return out.join("/");
}
