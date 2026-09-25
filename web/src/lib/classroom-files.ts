export const CLASSROOM_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const CLASSROOM_MAX_FILES = 24;

export const CLASSROOM_FILE_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "audio/mpeg": [".mp3"],
  "audio/mp4": [".m4a"],
  "audio/wav": [".wav"],
  "audio/webm": [".weba", ".webm"],
  "text/plain": [".txt"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "application/epub+zip": [".epub"],
};

export type ClassroomSharedFile = {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  userId: string;
  displayName: string;
  role?: string;
  createdAt: string;
  href: string;
};

export function classroomFileAccept() {
  return Object.keys(CLASSROOM_FILE_TYPES).join(",");
}

export function sanitizeClassroomFileName(name: string) {
  const cleaned = name
    .replace(/[/\\:\0]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "file";
}

export function resolveClassroomFileType(mime: string, name: string) {
  const lower = mime.toLowerCase().trim();
  if (CLASSROOM_FILE_TYPES[lower]) return lower;
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  for (const [type, exts] of Object.entries(CLASSROOM_FILE_TYPES)) {
    if (exts.includes(ext)) return type;
  }
  return null;
}

export function classroomFileKind(mime: string) {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/epub+zip") return "book";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "presentation";
  }
  return "document";
}

export function formatClassroomFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseClassroomSharedFile(value: unknown): ClassroomSharedFile | null {
  if (!value || typeof value !== "object") return null;
  const item = value as {
    id?: unknown;
    name?: unknown;
    mimeType?: unknown;
    byteSize?: unknown;
    userId?: unknown;
    displayName?: unknown;
    role?: unknown;
    createdAt?: unknown;
    href?: unknown;
  };
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.mimeType !== "string" ||
    typeof item.byteSize !== "number" ||
    typeof item.userId !== "string" ||
    typeof item.createdAt !== "string" ||
    typeof item.href !== "string"
  ) {
    return null;
  }
  return {
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    byteSize: item.byteSize,
    userId: item.userId,
    displayName:
      typeof item.displayName === "string" && item.displayName.trim()
        ? item.displayName
        : "Participant",
    role: typeof item.role === "string" ? item.role : undefined,
    createdAt: item.createdAt,
    href: item.href,
  };
}

export function mergeClassroomFiles(
  current: ClassroomSharedFile[],
  incoming: ClassroomSharedFile[],
) {
  if (!incoming.length) return current;
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-CLASSROOM_MAX_FILES);
}

export function classroomFileHref(classroomId: string, fileId: string) {
  return `/api/v1/classrooms/${classroomId}/files/${fileId}`;
}

export function asciiDownloadName(name: string) {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
  return ascii || "file";
}
