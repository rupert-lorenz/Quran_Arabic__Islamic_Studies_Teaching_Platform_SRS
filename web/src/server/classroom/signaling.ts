import { redis } from "@/redis/client";
import { CLASSROOM_PRESENCE_TTL_MS, CLASSROOM_SIGNAL_KEEP } from "@/lib/classroom";

export type ClassroomPresence = {
  userId: string;
  displayName: string;
  role: string;
  lastSeenAt: number;
  cameraOn: boolean;
  micOn: boolean;
  screenSharing: boolean;
};

export type ClassroomSignal = {
  id: string;
  type:
    | "offer"
    | "answer"
    | "ice"
    | "hangup"
    | "control"
    | "chat"
    | "file"
    | "whiteboard"
    | "pointer"
    | "presentation"
    | "recording";
  fromUserId: string;
  toUserId: string;
  payload: unknown;
  createdAt: number;
};

function presenceKey(classroomId: string) {
  return `classroom:${classroomId}:presence`;
}

function signalKey(classroomId: string, userId: string) {
  return `classroom:${classroomId}:signals:${userId}`;
}

export function parseClassroomPresence(value: string): ClassroomPresence | null {
  try {
    const item = JSON.parse(value) as Partial<ClassroomPresence>;
    if (!item.userId || !item.displayName || !item.role || !item.lastSeenAt) {
      return null;
    }
    return {
      userId: item.userId,
      displayName: item.displayName,
      role: item.role,
      lastSeenAt: item.lastSeenAt,
      cameraOn: item.cameraOn === true,
      micOn: item.micOn === true,
      screenSharing: item.screenSharing === true,
    };
  } catch {
    return null;
  }
}

export async function touchClassroomPresence(
  classroomId: string,
  presence: Omit<ClassroomPresence, "lastSeenAt" | "cameraOn" | "micOn" | "screenSharing"> & {
    cameraOn?: boolean;
    micOn?: boolean;
    screenSharing?: boolean;
  },
) {
  const key = presenceKey(classroomId);
  const previous = await redis.hget(key, presence.userId);
  const current = previous ? parseClassroomPresence(previous) : null;
  const record: ClassroomPresence = {
    userId: presence.userId,
    displayName: presence.displayName,
    role: presence.role,
    lastSeenAt: Date.now(),
    cameraOn: presence.cameraOn ?? current?.cameraOn ?? false,
    micOn: presence.micOn ?? current?.micOn ?? false,
    screenSharing: presence.screenSharing ?? current?.screenSharing ?? false,
  };
  await redis.hset(key, presence.userId, JSON.stringify(record));
  await redis.expire(key, 2 * 60 * 60);
}

export async function dropClassroomPresence(classroomId: string, userId: string) {
  await redis.hdel(presenceKey(classroomId), userId);
}

export async function listClassroomPresence(classroomId: string) {
  const raw = await redis.hgetall(presenceKey(classroomId));
  const cutoff = Date.now() - CLASSROOM_PRESENCE_TTL_MS;
  const people: ClassroomPresence[] = [];
  for (const value of Object.values(raw)) {
    const item = parseClassroomPresence(value);
    if (item && item.lastSeenAt >= cutoff) {
      people.push(item);
    }
  }
  return people.sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

export async function enqueueClassroomSignal(
  classroomId: string,
  signal: ClassroomSignal,
) {
  const key = signalKey(classroomId, signal.toUserId);
  await redis.lpush(key, JSON.stringify(signal));
  await redis.ltrim(key, 0, CLASSROOM_SIGNAL_KEEP - 1);
  await redis.expire(key, 2 * 60 * 60);
}

export async function broadcastClassroomSignal(
  classroomId: string,
  recipients: string[],
  signal: Omit<ClassroomSignal, "toUserId">,
) {
  await Promise.all(
    recipients.map((toUserId) =>
      enqueueClassroomSignal(classroomId, { ...signal, toUserId }),
    ),
  );
}

export async function takeClassroomSignals(classroomId: string, userId: string) {
  const key = signalKey(classroomId, userId);
  const raw = await redis.lrange(key, 0, -1);
  if (raw.length) {
    await redis.del(key);
  }
  return raw
    .reverse()
    .map((item) => {
      try {
        return JSON.parse(item) as ClassroomSignal;
      } catch {
        return null;
      }
    })
    .filter((item): item is ClassroomSignal => Boolean(item));
}
