import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import {
  CLASSROOM_BRAND_SETTING_KEY,
  parseClassroomOverlay,
  type ClassroomOverlay,
} from "@/lib/classroom-brand";
import { hasAnyPermission } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { getBrand } from "@/server/brand";

let cached:
  | { overlay: ClassroomOverlay; expiresAt: number }
  | undefined;

export async function getClassroomOverlay(): Promise<ClassroomOverlay> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.overlay;
  }
  const brand = await getBrand();
  try {
    const [row] = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, CLASSROOM_BRAND_SETTING_KEY))
      .limit(1);
    const overlay = parseClassroomOverlay(row?.value, brand);
    cached = { overlay, expiresAt: Date.now() + 30_000 };
    return overlay;
  } catch {
    return parseClassroomOverlay(undefined, brand);
  }
}

export function resetClassroomOverlayCache() {
  cached = undefined;
}

export async function getClassroomBrandWorkspace() {
  const [brand, overlay] = await Promise.all([getBrand(), getClassroomOverlay()]);
  return { brand, overlay };
}

export async function updateClassroomOverlay(
  actor: ApiActor,
  input: ClassroomOverlay,
  ip: string,
) {
  if (!hasAnyPermission(actor, "settings.write")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change classroom branding");
  }
  const brand = await getBrand();
  const overlay = parseClassroomOverlay(input, brand);
  await db
    .insert(platformSettings)
    .values({ key: CLASSROOM_BRAND_SETTING_KEY, value: overlay })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: overlay },
    });
  resetClassroomOverlayCache();
  await writeAuditLog({
    actor,
    action: "settings.classroom_brand_updated",
    entityType: "platform_settings",
    entityId: CLASSROOM_BRAND_SETTING_KEY,
    ipAddress: ip,
    metadata: { watermark: overlay.watermark },
  });
  return { brand, overlay };
}
