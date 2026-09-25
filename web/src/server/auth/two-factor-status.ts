import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userTotp } from "@/db/schema";
import {
  cacheTotpEnabled,
  clearTotpEnabledCache,
  readCachedTotpEnabled,
} from "@/redis/two-factor";

export async function isTotpEnabled(userId: string) {
  const cached = await readCachedTotpEnabled(userId);
  if (cached !== null) {
    return cached;
  }

  const [row] = await db
    .select({ enabledAt: userTotp.enabledAt })
    .from(userTotp)
    .where(eq(userTotp.userId, userId))
    .limit(1);

  const enabled = Boolean(row?.enabledAt);
  await cacheTotpEnabled(userId, enabled);
  return enabled;
}

export async function markTotpEnabled(userId: string) {
  await clearTotpEnabledCache(userId);
  await cacheTotpEnabled(userId, true);
}
