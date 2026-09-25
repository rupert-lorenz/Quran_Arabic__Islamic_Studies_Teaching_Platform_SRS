import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { defaultSiteSeo, parseSiteSeo, type SiteSeo } from "@/lib/seo";
import { hasAnyPermission } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import type { UpdateSiteSeoInput } from "@/server/staff/schemas";

export const SEO_SETTING_KEY = "seo.site";

export async function getSiteSeo(): Promise<SiteSeo> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, SEO_SETTING_KEY))
    .limit(1);
  return parseSiteSeo(row?.value);
}

function assertCanWriteSeo(actor: ApiActor) {
  if (!hasAnyPermission(actor, ["settings.write", "cms.write"])) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change SEO settings");
  }
}

export async function getSeoWorkspace() {
  return getSiteSeo();
}

export async function updateSiteSeo(
  actor: ApiActor,
  input: UpdateSiteSeoInput,
  ip: string,
) {
  assertCanWriteSeo(actor);
  const next: SiteSeo = {
    defaultTitle: input.defaultTitle.trim(),
    defaultDescription: input.defaultDescription.trim(),
    robotsIndex: input.robotsIndex,
  };
  await db
    .insert(platformSettings)
    .values({ key: SEO_SETTING_KEY, value: next })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: next },
    });
  await writeAuditLog({
    actor,
    action: "settings.seo_updated",
    entityType: "platform_settings",
    entityId: SEO_SETTING_KEY,
    ipAddress: ip,
    metadata: { robotsIndex: next.robotsIndex },
  });
  return next;
}

export { defaultSiteSeo };
