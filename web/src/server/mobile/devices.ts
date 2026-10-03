import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { mobileDevices } from "@/db/schema";
import { MOBILE_PLATFORMS } from "@/lib/mobile";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";

export const registerMobileDeviceSchema = z.object({
  platform: z.enum(MOBILE_PLATFORMS),
  appVersion: z.string().trim().max(40).optional(),
});

export async function registerMobileDevice(
  actor: ApiActor,
  input: z.infer<typeof registerMobileDeviceSchema>,
  ip?: string,
) {
  const now = new Date();
  const [row] = await db
    .insert(mobileDevices)
    .values({
      userId: actor.userId,
      platform: input.platform,
      appVersion: input.appVersion || null,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [mobileDevices.userId, mobileDevices.platform],
      set: {
        appVersion: input.appVersion || null,
        lastSeenAt: now,
      },
    })
    .returning({
      id: mobileDevices.id,
      platform: mobileDevices.platform,
      lastSeenAt: mobileDevices.lastSeenAt,
    });

  await writeAuditLog({
    actor,
    action: "mobile.device.registered",
    entityType: "mobile_device",
    entityId: row?.id,
    metadata: { platform: input.platform },
    ipAddress: ip,
  });

  return {
    platform: input.platform,
    registered: true,
    delivery: "not_connected" as const,
    sent: 0,
    lastSeenAt: row?.lastSeenAt ?? now,
  };
}

export async function listOwnDevices(userId: string) {
  return db
    .select({
      id: mobileDevices.id,
      platform: mobileDevices.platform,
      appVersion: mobileDevices.appVersion,
      lastSeenAt: mobileDevices.lastSeenAt,
    })
    .from(mobileDevices)
    .where(eq(mobileDevices.userId, userId));
}
