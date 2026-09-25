import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { files, teacherProfiles } from "@/db/schema";
import { parseTeacherPhotoUrl } from "@/lib/teacher-photo";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { externalUrlFromStorageKey } from "./files";

export async function latestTeacherPhotoUrl(userId: string) {
  const [row] = await db
    .select({ storageKey: files.storageKey })
    .from(files)
    .where(and(eq(files.ownerUserId, userId), eq(files.purpose, "avatar")))
    .orderBy(desc(files.createdAt))
    .limit(1);
  return row ? externalUrlFromStorageKey(row.storageKey) : null;
}

export async function setTeacherPhoto(
  actor: ApiActor,
  input: { externalUrl: string },
  ip: string,
) {
  if (actor.roleKey !== "teacher") {
    throw new ApiError(403, "FORBIDDEN", "Only teachers can set a profile photo");
  }
  const [profile] = await db
    .select({ userId: teacherProfiles.userId })
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, actor.userId))
    .limit(1);
  if (!profile) {
    throw new ApiError(404, "NOT_FOUND", "Teacher profile not found");
  }

  const photoUrl = parseTeacherPhotoUrl(input.externalUrl);
  if (!photoUrl || photoUrl.startsWith("/")) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Use an https image link (jpg, png, webp, or a hosted photo URL)",
    );
  }

  const [created] = await db
    .insert(files)
    .values({
      ownerUserId: actor.userId,
      purpose: "avatar",
      storageKey: `external:${actor.userId}:avatar:${crypto.randomUUID()}:${photoUrl}`,
      mimeType: "image/jpeg",
      byteSize: 0,
      originalName: "Profile photo",
      visibility: "public",
    })
    .returning();
  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not save the profile photo");
  }

  await writeAuditLog({
    actor,
    action: "teachers.photo_updated",
    entityType: "file",
    entityId: created.id,
    ipAddress: ip,
  });

  return { photoUrl };
}
