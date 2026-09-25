export const CLASSROOM_OPEN_BEFORE_MS = 15 * 60 * 1000;
export const CLASSROOM_OPEN_AFTER_MS = 30 * 60 * 1000;
export const CLASSROOM_JOIN_TOKEN_TTL_SECONDS = 15 * 60;
export const CLASSROOM_PRESENCE_TTL_MS = 45 * 1000;
export const CLASSROOM_MAX_MESSAGE_LENGTH = 500;
export const CLASSROOM_MAX_MESSAGES = 80;
export const CLASSROOM_MAX_WHITEBOARD_STROKES = 80;
export const CLASSROOM_SIGNAL_KEEP = 400;
export const CLASSROOM_TIMER_WARN_MS = 5 * 60 * 1000;
export const CLASSROOM_TIMER_URGENT_MS = 60 * 1000;

const PARTICIPANT_ROLE_ORDER: Record<string, number> = {
  teacher: 0,
  staff: 1,
  student: 2,
  parent: 3,
};

export function sortClassroomParticipants<
  T extends { role: string; displayName: string },
>(people: T[]) {
  return [...people].sort((left, right) => {
    const role =
      (PARTICIPANT_ROLE_ORDER[left.role] ?? 9) -
      (PARTICIPANT_ROLE_ORDER[right.role] ?? 9);
    if (role) return role;
    return left.displayName.localeCompare(right.displayName);
  });
}

export function classroomTileGridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4";
}

export type ClassroomLessonKind = "booking" | "group";
export type ClassroomParticipantRole =
  | "teacher"
  | "student"
  | "parent"
  | "staff";

export type ClassroomJoinFields = {
  classroomJoinable: boolean;
  classroomHref: string;
  classroomOpensAt: string;
};

export function classroomJoinHref(kind: ClassroomLessonKind, id: string) {
  const key = kind === "booking" ? "bookingId" : "groupLessonId";
  return `/classroom/join?${key}=${encodeURIComponent(id)}`;
}

export type ClassroomTimerPhase = "upcoming" | "live" | "overtime" | "closed";

export type ClassroomTimerState = {
  phase: ClassroomTimerPhase;
  remainingMs: number;
  elapsedMs: number;
  durationMs: number;
  progress: number;
  warn: boolean;
  urgent: boolean;
};

export function classroomTimerState(
  startsAt: Date | string,
  endsAt: Date | string,
  now = Date.now(),
): ClassroomTimerState {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const close = end + CLASSROOM_OPEN_AFTER_MS;
  const durationMs = Math.max(1, end - start);
  if (now < start) {
    return {
      phase: "upcoming",
      remainingMs: start - now,
      elapsedMs: 0,
      durationMs,
      progress: 0,
      warn: false,
      urgent: false,
    };
  }
  if (now < end) {
    const remainingMs = end - now;
    return {
      phase: "live",
      remainingMs,
      elapsedMs: now - start,
      durationMs,
      progress: Math.min(1, (now - start) / durationMs),
      warn: remainingMs <= CLASSROOM_TIMER_WARN_MS,
      urgent: remainingMs <= CLASSROOM_TIMER_URGENT_MS,
    };
  }
  if (now < close) {
    return {
      phase: "overtime",
      remainingMs: close - now,
      elapsedMs: now - start,
      durationMs,
      progress: 1,
      warn: true,
      urgent: true,
    };
  }
  return {
    phase: "closed",
    remainingMs: 0,
    elapsedMs: durationMs,
    durationMs,
    progress: 1,
    warn: false,
    urgent: false,
  };
}

export function formatClassroomCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function classroomJoinWindow(startsAt: Date, endsAt: Date) {
  const opensAt = new Date(startsAt.getTime() - CLASSROOM_OPEN_BEFORE_MS);
  const closesAt = new Date(endsAt.getTime() + CLASSROOM_OPEN_AFTER_MS);
  const now = Date.now();
  return {
    opensAt,
    closesAt,
    joinable: now >= opensAt.getTime() && now <= closesAt.getTime(),
    upcoming: now < opensAt.getTime(),
    ended: now > closesAt.getTime(),
  };
}

export function classroomStatusAllowsJoin(
  kind: ClassroomLessonKind,
  status: string,
) {
  if (kind === "booking") {
    return status === "confirmed" || status === "completed";
  }
  return status === "published" || status === "completed";
}

export function classroomJoinFields(
  kind: ClassroomLessonKind,
  id: string,
  status: string,
  startsAt: Date,
  endsAt: Date,
): ClassroomJoinFields {
  const window = classroomJoinWindow(startsAt, endsAt);
  return {
    classroomJoinable:
      classroomStatusAllowsJoin(kind, status) && window.joinable,
    classroomHref: classroomJoinHref(kind, id),
    classroomOpensAt: window.opensAt.toISOString(),
  };
}

export function classroomContainsContactDetails(value: string) {
  const text = value.toLowerCase();
  if (
    /\b(whatsapp|telegram|signal|imo|viber|wechat|line)\b/.test(text) ||
    /@/.test(text)
  ) {
    return true;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8;
}

export type ClassroomChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  role?: string;
  body: string;
  createdAt: string;
};

export function parseClassroomChatMessage(value: unknown): ClassroomChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const item = value as {
    id?: unknown;
    userId?: unknown;
    displayName?: unknown;
    role?: unknown;
    body?: unknown;
    createdAt?: unknown;
  };
  if (
    typeof item.id !== "string" ||
    typeof item.userId !== "string" ||
    typeof item.body !== "string" ||
    typeof item.createdAt !== "string"
  ) {
    return null;
  }
  return {
    id: item.id,
    userId: item.userId,
    displayName:
      typeof item.displayName === "string" && item.displayName.trim()
        ? item.displayName
        : "Participant",
    role: typeof item.role === "string" ? item.role : undefined,
    body: item.body,
    createdAt: item.createdAt,
  };
}

export function mergeClassroomMessages<T extends { id: string; createdAt: string }>(
  current: T[],
  incoming: T[],
) {
  if (!incoming.length) return current;
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-CLASSROOM_MAX_MESSAGES);
}
