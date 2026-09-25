import { randomBytes } from "node:crypto";
import { redis } from "./client";
import { hashToken } from "@/server/api/request";

export const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 10 * 60;

export type TwoFactorPurpose = "verify" | "enroll";

export type TwoFactorChallenge = {
  userId: string;
  roleKey: string;
  email: string;
  displayName: string;
  locale?: string;
  currency?: string | null;
  country?: string | null;
  purpose: TwoFactorPurpose;
};

function challengeKey(tokenHash: string) {
  return `auth:2fa:challenge:${tokenHash}`;
}

function pendingSecretKey(userId: string) {
  return `auth:2fa:pending:${userId}`;
}

function totpFlagKey(userId: string) {
  return `totp:on:${userId}`;
}

export async function createTwoFactorChallenge(data: TwoFactorChallenge) {
  const token = randomBytes(32).toString("base64url");
  await redis.set(
    challengeKey(hashToken(token)),
    JSON.stringify(data),
    "EX",
    TWO_FACTOR_CHALLENGE_TTL_SECONDS,
  );
  return token;
}

export async function getTwoFactorChallenge(token?: string) {
  if (!token) {
    return null;
  }

  const value = await redis.get(challengeKey(hashToken(token))).catch(() => null);
  if (!value) {
    return null;
  }

  return JSON.parse(value) as TwoFactorChallenge;
}

export async function consumeTwoFactorChallenge(token?: string) {
  const challenge = await getTwoFactorChallenge(token);
  if (!token || !challenge) {
    return null;
  }

  await redis.del(challengeKey(hashToken(token))).catch(() => undefined);
  return challenge;
}

export async function setPendingTotpSecret(userId: string, secret: string) {
  await redis.set(
    pendingSecretKey(userId),
    secret,
    "EX",
    TWO_FACTOR_CHALLENGE_TTL_SECONDS,
  );
}

export async function getPendingTotpSecret(userId: string) {
  return redis.get(pendingSecretKey(userId));
}

export async function clearPendingTotpSecret(userId: string) {
  await redis.del(pendingSecretKey(userId)).catch(() => undefined);
}

export async function cacheTotpEnabled(userId: string, enabled: boolean) {
  await redis
    .set(totpFlagKey(userId), enabled ? "1" : "0", "EX", 60)
    .catch(() => undefined);
}

export async function readCachedTotpEnabled(userId: string) {
  const value = await redis.get(totpFlagKey(userId)).catch(() => null);
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

export async function clearTotpEnabledCache(userId: string) {
  await redis.del(totpFlagKey(userId)).catch(() => undefined);
}
