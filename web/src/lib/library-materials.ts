import { CLASSROOM_FILE_TYPES } from "./classroom-files";
import { CLASSROOM_PPTX_MIME } from "./classroom-pptx";

export const LIBRARY_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const TEACHING_MATERIAL_CATEGORIES = [
  "quran_book",
  "arabic_book",
  "islamic_studies_book",
  "teacher_guide",
  "worksheet",
  "presentation",
  "video",
  "game",
  "assessment",
  "audio",
] as const;

export type TeachingMaterialCategory =
  (typeof TEACHING_MATERIAL_CATEGORIES)[number];

export const TEACHING_MATERIAL_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;

export type TeachingMaterialStatus =
  (typeof TEACHING_MATERIAL_STATUSES)[number];

export const TEACHING_MATERIAL_AUDIENCES = [
  "learners",
  "teachers",
  "staff",
] as const;

export type TeachingMaterialAudience =
  (typeof TEACHING_MATERIAL_AUDIENCES)[number];

export const LIBRARY_ACCESS_MODES = ["open", "entitled"] as const;

export type LibraryAccessMode = (typeof LIBRARY_ACCESS_MODES)[number];

export const LIBRARY_RULE_TYPES = [
  "role",
  "live_course",
  "group_lesson",
  "subscription",
  "licence",
  "purchase",
] as const;

export type LibraryRuleType = (typeof LIBRARY_RULE_TYPES)[number];

export const LIBRARY_GRANT_SOURCES = [
  "staff",
  "purchase",
  "subscription",
  "licence",
] as const;

export type LibraryGrantSource = (typeof LIBRARY_GRANT_SOURCES)[number];

export const LIBRARY_ROLE_REFS = [
  "student",
  "parent",
  "teacher",
  "staff",
] as const;

export type LibraryRoleRef = (typeof LIBRARY_ROLE_REFS)[number];

export const LIBRARY_SUBSCRIPTION_STATUSES = ["active", "ended"] as const;

export type LibrarySubscriptionStatus =
  (typeof LIBRARY_SUBSCRIPTION_STATUSES)[number];

export type LibraryLockReason =
  | "course"
  | "subscription"
  | "licence"
  | "rental"
  | "purchase"
  | "contact";

export const LIBRARY_EXPIRY_KINDS = [
  "purchase",
  "rental",
  "subscription",
  "licence",
  "grant",
] as const;

export type LibraryExpiryKind = (typeof LIBRARY_EXPIRY_KINDS)[number];

export type LibraryExpiryStatus = "open" | "active" | "expiring" | "expired";

export function libraryExpiryDaysLeft(expiresAt?: string | Date | null) {
  if (!expiresAt) return null;
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function libraryExpiryStatus(
  expiresAt?: string | Date | null,
): LibraryExpiryStatus {
  const days = libraryExpiryDaysLeft(expiresAt);
  if (days === null) return "open";
  if (days < 0) return "expired";
  if (days <= 7) return "expiring";
  return "active";
}

export function libraryExpiryStillValid(
  expiresAt?: Date | null,
  revokedAt?: Date | null,
) {
  if (revokedAt) return false;
  return !expiresAt || expiresAt.getTime() > Date.now();
}

export function libraryCanDownloadFile(input: {
  downloadsRestricted?: boolean | null;
  canManage: boolean;
  isOwner: boolean;
}) {
  if (!input.downloadsRestricted) return true;
  return input.canManage || input.isOwner;
}

export function libraryFileNeedsDownload(mimeType: string) {
  return (
    !mimeType.startsWith("image/") &&
    !mimeType.startsWith("video/") &&
    !mimeType.startsWith("audio/") &&
    mimeType !== "application/pdf"
  );
}

export function defaultLibraryAccessMode(): LibraryAccessMode {
  return "open";
}

export const LIBRARY_FILE_TYPES: Record<string, string[]> = {
  ...CLASSROOM_FILE_TYPES,
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/quicktime": [".mov"],
  "video/ogg": [".ogv"],
  "audio/ogg": [".ogg", ".oga"],
};

export function libraryFileAccept() {
  return Object.keys(LIBRARY_FILE_TYPES).join(",");
}

export function defaultLibraryAudience(
  category: TeachingMaterialCategory,
): TeachingMaterialAudience {
  return category === "teacher_guide" ? "teachers" : "learners";
}

export function resolveLibraryFileType(mime: string, name: string) {
  const lower = mime.toLowerCase().trim();
  if (LIBRARY_FILE_TYPES[lower]) return lower;
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  for (const [type, exts] of Object.entries(LIBRARY_FILE_TYPES)) {
    if (exts.includes(ext)) return type;
  }
  return null;
}

export function libraryFileHref(id: string, download = false) {
  const path = `/api/v1/library/${id}/file`;
  return download ? `${path}?download=1` : path;
}

export const LIBRARY_BOOK_CATEGORIES = [
  "quran_book",
  "arabic_book",
  "islamic_studies_book",
] as const;

export type LibraryBookCategory = (typeof LIBRARY_BOOK_CATEGORIES)[number];

export const LIBRARY_MAX_BOOK_PAGES = 200;

export const LIBRARY_BOOK_SUBJECT: Record<LibraryBookCategory, string> = {
  quran_book: "quran",
  arabic_book: "arabic",
  islamic_studies_book: "islamic-studies",
};

export function isLibraryBookCategory(
  category: string,
): category is LibraryBookCategory {
  return (LIBRARY_BOOK_CATEGORIES as readonly string[]).includes(category);
}

export function isLibraryBookMime(mime: string) {
  return mime === "application/pdf" || mime === "application/epub+zip";
}

export function libraryBookAccept() {
  return "application/pdf,application/epub+zip,.pdf,.epub";
}

export function libraryBookHref(id: string) {
  return `/library/${id}`;
}

export function libraryCourseHref(id: string) {
  return `/library/course/${id}`;
}

export function libraryCourseLessonHref(
  courseId: string,
  lessonId: string,
  studentUserId?: string | null,
) {
  const params = new URLSearchParams({ lesson: lessonId });
  if (studentUserId) params.set("student", studentUserId);
  return `/library/course/${courseId}?${params.toString()}`;
}

export function libraryCourseProgressPercent(completed: number, total: number) {
  if (total < 1) return 0;
  return Math.round((completed / total) * 100);
}

export function libraryBookPageHref(materialId: string, pageId: string) {
  return `/api/v1/library/${materialId}/pages/${pageId}`;
}

export const LIBRARY_ACTIVITY_CATEGORIES = [
  "teacher_guide",
  "worksheet",
  "presentation",
  "video",
  "game",
  "assessment",
  "audio",
] as const;

export type LibraryActivityCategory =
  (typeof LIBRARY_ACTIVITY_CATEGORIES)[number];

export const LIBRARY_MAX_SLIDES = 80;

const LIBRARY_BOOK_MIMES = [
  "application/pdf",
  "application/epub+zip",
] as const;

const LIBRARY_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

const LIBRARY_VIDEO_MIMES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
] as const;

const LIBRARY_AUDIO_MIMES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
] as const;

const LIBRARY_DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const LIBRARY_CATEGORY_MIMES: Record<
  TeachingMaterialCategory,
  readonly string[]
> = {
  quran_book: LIBRARY_BOOK_MIMES,
  arabic_book: LIBRARY_BOOK_MIMES,
  islamic_studies_book: LIBRARY_BOOK_MIMES,
  teacher_guide: [...LIBRARY_BOOK_MIMES, LIBRARY_DOCX_MIME],
  worksheet: ["application/pdf", ...LIBRARY_IMAGE_MIMES, LIBRARY_DOCX_MIME],
  presentation: [CLASSROOM_PPTX_MIME, "application/pdf"],
  video: LIBRARY_VIDEO_MIMES,
  game: ["application/pdf", ...LIBRARY_IMAGE_MIMES, ...LIBRARY_VIDEO_MIMES],
  assessment: ["application/pdf", ...LIBRARY_IMAGE_MIMES, LIBRARY_DOCX_MIME],
  audio: LIBRARY_AUDIO_MIMES,
};

export const LIBRARY_CATEGORY_LABEL = {
  quran_book: "library.cat.quran_book",
  arabic_book: "library.cat.arabic_book",
  islamic_studies_book: "library.cat.islamic_studies_book",
  teacher_guide: "library.cat.teacher_guide",
  worksheet: "library.cat.worksheet",
  presentation: "library.cat.presentation",
  video: "library.cat.video",
  game: "library.cat.game",
  assessment: "library.cat.assessment",
  audio: "library.cat.audio",
} as const;

export function isLibraryActivityCategory(
  category: string,
): category is LibraryActivityCategory {
  return (LIBRARY_ACTIVITY_CATEGORIES as readonly string[]).includes(category);
}

export function isLibraryCategoryMime(
  category: TeachingMaterialCategory,
  mime: string,
) {
  return LIBRARY_CATEGORY_MIMES[category].includes(mime);
}

export function isLibraryVideoMime(mime: string) {
  return mime.startsWith("video/");
}

export function isLibraryAudioMime(mime: string) {
  return mime.startsWith("audio/");
}

export const LIBRARY_COURSE_CONTENT_KINDS = [
  "video",
  "audio",
  "pdf",
  "flipbook",
] as const;

export type LibraryCourseContentKind =
  (typeof LIBRARY_COURSE_CONTENT_KINDS)[number];

export function libraryCourseContentKind(
  category: TeachingMaterialCategory,
  mimeType: string,
  pageCount = 0,
): LibraryCourseContentKind | null {
  if (isLibraryAudioMime(mimeType) || category === "audio") return "audio";
  if (isLibraryVideoMime(mimeType) || category === "video") return "video";
  if (pageCount < 1) return null;
  if (isLibraryBookCategory(category) || mimeType === "application/epub+zip") {
    return "flipbook";
  }
  return "pdf";
}

export function isLibraryImageMime(mime: string) {
  return (LIBRARY_IMAGE_MIMES as readonly string[]).includes(mime);
}

export function libraryCategoryAccept(category: TeachingMaterialCategory) {
  const mimes = LIBRARY_CATEGORY_MIMES[category];
  const extras = mimes.flatMap((mime) => LIBRARY_FILE_TYPES[mime] ?? []);
  return [...mimes, ...extras].join(",");
}

export function libraryFileHelpKey(
  category: TeachingMaterialCategory,
):
  | "library.book_file_help"
  | `library.file_help.${LibraryActivityCategory}` {
  if (isLibraryBookCategory(category)) return "library.book_file_help";
  return `library.file_help.${category}`;
}

export function libraryMimeError(category: TeachingMaterialCategory) {
  switch (category) {
    case "quran_book":
    case "arabic_book":
    case "islamic_studies_book":
      return "Qur'an, Arabic, and Islamic Studies books must be a PDF or EPUB";
    case "teacher_guide":
      return "Teacher guides must be a PDF, EPUB, or Word file";
    case "worksheet":
      return "Worksheets must be a PDF, image, or Word file";
    case "presentation":
      return "Presentations must be a PowerPoint or PDF";
    case "video":
      return "Videos must be an MP4, WebM, MOV, or OGG file";
    case "game":
      return "Games must be a PDF, image, or video file";
    case "assessment":
      return "Assessments must be a PDF, image, or Word file";
    case "audio":
      return "Audio lessons must be an MP3, M4A, WAV, WebM, or OGG file";
  }
}

export function coerceLibraryAudience(
  category: TeachingMaterialCategory,
  audience?: TeachingMaterialAudience,
): TeachingMaterialAudience {
  const next = audience ?? defaultLibraryAudience(category);
  if (category === "teacher_guide" && next === "learners") return "teachers";
  return next;
}

export type LibraryOpenKind = "flipbook" | "slides" | "video" | "audio";

export function libraryOpenKind(
  category: TeachingMaterialCategory,
  mimeType: string,
  pageCount: number,
): LibraryOpenKind | null {
  if (isLibraryAudioMime(mimeType) || category === "audio") return "audio";
  if (isLibraryVideoMime(mimeType) || category === "video") return "video";
  if (category === "presentation" && pageCount > 0) return "slides";
  if (pageCount > 0) return "flipbook";
  return null;
}

export function formatLibraryFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
