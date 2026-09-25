import { CLASSROOM_MAX_BOOKMARKS } from "@/lib/classroom-pptx";

const listeners = new Set<() => void>();

function key(id: string) {
  return `library.bookmarks.${id}`;
}

export function readLibraryBookmarks(id: string) {
  if (typeof window === "undefined") return [] as number[];
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is number => typeof item === "number" && Number.isInteger(item))
      .slice(0, CLASSROOM_MAX_BOOKMARKS);
  } catch {
    return [];
  }
}

export function writeLibraryBookmarks(id: string, indexes: number[]) {
  window.localStorage.setItem(key(id), JSON.stringify(indexes.slice(0, CLASSROOM_MAX_BOOKMARKS)));
  listeners.forEach((listener) => listener());
}

export function subscribeLibraryBookmarks(onStore: () => void) {
  listeners.add(onStore);
  return () => {
    listeners.delete(onStore);
  };
}

export function toggleLibraryBookmark(id: string, index: number, total: number) {
  if (index < 0 || index >= total) return readLibraryBookmarks(id);
  const current = readLibraryBookmarks(id);
  const next = current.includes(index)
    ? current.filter((item) => item !== index)
    : [...current, index].sort((left, right) => left - right);
  writeLibraryBookmarks(id, next);
  return next;
}
