import { and, eq, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { accountTokens } from "@/db/schema";
import { hashToken } from "@/server/api/request";
import { getConfig } from "@/server/config";

const ttlMs = {
  email_verify: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
} as const;

export async function issueAccountToken(
  userId: string,
  purpose: "email_verify" | "password_reset",
) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);

  await db
    .delete(accountTokens)
    .where(
      and(
        eq(accountTokens.userId, userId),
        eq(accountTokens.purpose, purpose),
        isNull(accountTokens.usedAt),
      ),
    );

  await db.insert(accountTokens).values({
    userId,
    purpose,
    tokenHash,
    expiresAt: new Date(Date.now() + ttlMs[purpose]),
  });

  return token;
}

export async function consumeAccountToken(
  token: string,
  purpose: "email_verify" | "password_reset",
) {
  const tokenHash = hashToken(token);
  const [row] = await db
    .select()
    .from(accountTokens)
    .where(
      and(
        eq(accountTokens.tokenHash, tokenHash),
        eq(accountTokens.purpose, purpose),
      ),
    )
    .limit(1);

  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  await db
    .update(accountTokens)
    .set({ usedAt: new Date() })
    .where(eq(accountTokens.id, row.id));

  return row;
}

export function accountActionUrl(
  path: string,
  token: string,
  queryName = "token",
) {
  const url = new URL(path, getConfig().APP_URL);
  url.searchParams.set(queryName, token);
  return url.toString();
}
