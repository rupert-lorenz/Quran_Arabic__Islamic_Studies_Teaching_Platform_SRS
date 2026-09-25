import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classroomParticipants, classrooms } from "@/db/schema";
import { CLASSROOM_PRESENCE_TTL_MS } from "@/lib/classroom";
import { MAX_LESSON_DURATION_MINUTES } from "@/lib/lesson-history";
import { clampLessonMinutes } from "@/lib/attendance";

export function accumulateAttendedSeconds(
  attendedSeconds: number,
  lastSeenAt: Date,
  now = new Date(),
) {
  const delta = now.getTime() - lastSeenAt.getTime();
  if (delta <= 0) return Math.max(0, attendedSeconds);
  const added = Math.min(delta, CLASSROOM_PRESENCE_TTL_MS);
  return Math.max(0, attendedSeconds + Math.round(added / 1000));
}

export function minutesFromAttendedSeconds(seconds: number) {
  return Math.min(
    MAX_LESSON_DURATION_MINUTES,
    clampLessonMinutes(seconds / 60),
  );
}

export async function resolveClassroomAttendedMinutes(input: {
  studentUserId: string;
  bookingId?: string | null;
  groupLessonId?: string | null;
}) {
  const [room] = await db
    .select({ id: classrooms.id })
    .from(classrooms)
    .where(
      input.bookingId
        ? eq(classrooms.bookingId, input.bookingId)
        : input.groupLessonId
          ? eq(classrooms.groupLessonId, input.groupLessonId)
          : eq(classrooms.id, "00000000-0000-0000-0000-000000000000"),
    )
    .limit(1);
  if (!room) return null;
  const [row] = await db
    .select()
    .from(classroomParticipants)
    .where(
      and(
        eq(classroomParticipants.classroomId, room.id),
        eq(classroomParticipants.userId, input.studentUserId),
      ),
    )
    .limit(1);
  if (!row) return null;
  const now = new Date();
  const attendedSeconds = row.leftAt
    ? row.attendedSeconds
    : accumulateAttendedSeconds(row.attendedSeconds, row.lastSeenAt, now);
  if (attendedSeconds !== row.attendedSeconds) {
    await db
      .update(classroomParticipants)
      .set({ attendedSeconds, lastSeenAt: now })
      .where(eq(classroomParticipants.id, row.id));
  }
  return minutesFromAttendedSeconds(attendedSeconds);
}

export async function attendedMinutesForRecord(input: {
  studentUserId: string;
  bookingId?: string | null;
  groupLessonId?: string | null;
  scheduledMinutes: number;
  status: "completed" | "no_show" | "cancelled";
}) {
  if (input.status !== "completed") return 0;
  const actual = await resolveClassroomAttendedMinutes(input);
  return actual ?? clampLessonMinutes(input.scheduledMinutes);
}
