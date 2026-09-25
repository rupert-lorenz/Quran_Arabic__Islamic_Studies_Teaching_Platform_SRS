import { and, eq, isNull } from "drizzle-orm";
import { toDataURL } from "qrcode";
import { db } from "@/db";
import { totpRecoveryCodes, userTotp, users } from "@/db/schema";
import { isStaffRole } from "@/lib/rbac";
import {
  clearPendingTotpSecret,
  consumeTwoFactorChallenge,
  createTwoFactorChallenge,
  getPendingTotpSecret,
  getTwoFactorChallenge,
  setPendingTotpSecret,
  type TwoFactorChallenge,
} from "@/redis/two-factor";
import { writeAuditLog } from "@/server/api/audit";
import { safeRecordPresence } from "@/server/lms/presence";
import { ApiError } from "@/server/api/errors";
import { getBrand } from "@/server/brand";
import { recordFailedLogin } from "./lockout";
import {
  createUserSession,
  destroyAllUserSessions,
  loadUserById,
  type SessionUser,
} from "./session";
import {
  buildOtpauthUrl,
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotpCode,
} from "./totp";
import { isTotpEnabled, markTotpEnabled } from "./two-factor-status";

export function requiresTwoFactor(roleKey: string) {
  return isStaffRole(roleKey);
}

export async function startTwoFactorChallenge(user: SessionUser, ip: string) {
  const enrolled = await isTotpEnabled(user.id);
  const token = await createTwoFactorChallenge({
    userId: user.id,
    roleKey: user.roleKey,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    currency: user.currency,
    country: user.country,
    purpose: enrolled ? "verify" : "enroll",
  });

  await writeAuditLog({
    actor: { userId: user.id, roleKey: user.roleKey, permissions: [] },
    action: enrolled
      ? "account.two_factor_challenged"
      : "account.two_factor_setup_required",
    entityType: "user",
    entityId: user.id,
    ipAddress: ip,
  });

  return { token, enrolled };
}

export async function readTwoFactorChallenge(token?: string) {
  const challenge = await getTwoFactorChallenge(token);
  if (!challenge) {
    throw new ApiError(
      401,
      "TWO_FACTOR_REQUIRED",
      "Enter your password again to continue two-factor authentication",
    );
  }

  return {
    purpose: challenge.purpose,
    displayName: challenge.displayName,
    enrolled: challenge.purpose === "verify",
  };
}

export async function beginTwoFactorSetup(user: SessionUser) {
  if (!requiresTwoFactor(user.roleKey)) {
    throw new ApiError(
      400,
      "TWO_FACTOR_NOT_REQUIRED",
      "Two-factor authentication is only required for staff accounts",
    );
  }

  if (await isTotpEnabled(user.id)) {
    throw new ApiError(
      400,
      "TWO_FACTOR_ENABLED",
      "This account already has an authenticator",
    );
  }

  const secret = generateTotpSecret();
  await setPendingTotpSecret(user.id, secret);
  const brand = await getBrand();
  const otpauthUrl = buildOtpauthUrl({
    issuer: brand.name,
    accountName: user.email,
    secret,
  });

  return {
    secret,
    otpauthUrl,
    qrDataUrl: await toDataURL(otpauthUrl, { margin: 1, width: 220 }),
  };
}

export async function confirmTwoFactorSetup(input: {
  user: SessionUser;
  code: string;
  ip: string;
  userAgent: string;
}) {
  const secret = await getPendingTotpSecret(input.user.id);
  if (!secret) {
    throw new ApiError(
      400,
      "TWO_FACTOR_SETUP_EXPIRED",
      "Authenticator setup expired. Start again.",
    );
  }

  const verified = verifyTotpCode(secret, input.code);
  if (!verified.ok) {
    await recordFailedLogin(input.user.email, input.ip).catch(() => undefined);
    throw new ApiError(401, "INVALID_CODE", "That authenticator code is incorrect");
  }

  const recoveryCodes = generateRecoveryCodes();
  await db.transaction(async (tx) => {
    await tx
      .delete(totpRecoveryCodes)
      .where(eq(totpRecoveryCodes.userId, input.user.id));
    await tx
      .insert(userTotp)
      .values({
        userId: input.user.id,
        secretEncrypted: encryptTotpSecret(secret),
        enabledAt: new Date(),
        lastUsedStep: verified.step,
      })
      .onConflictDoUpdate({
        target: userTotp.userId,
        set: {
          secretEncrypted: encryptTotpSecret(secret),
          enabledAt: new Date(),
          lastUsedStep: verified.step,
        },
      });
    await tx.insert(totpRecoveryCodes).values(
      recoveryCodes.map((code) => ({
        userId: input.user.id,
        codeHash: hashRecoveryCode(code),
      })),
    );
  });

  await clearPendingTotpSecret(input.user.id);
  await markTotpEnabled(input.user.id);
  await destroyAllUserSessions(input.user.id);

  const session = await createUserSession(
    input.user,
    { ip: input.ip, userAgent: input.userAgent },
    { twoFactorVerified: true },
  );

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, input.user.id));

  await writeAuditLog({
    actor: { userId: input.user.id, roleKey: input.user.roleKey, permissions: [] },
    action: "account.two_factor_enrolled",
    entityType: "user",
    entityId: input.user.id,
    ipAddress: input.ip,
  });
  await safeRecordPresence({
    userId: input.user.id,
    kind: "login",
    ipAddress: input.ip,
  });

  return { session, recoveryCodes };
}

export async function verifyTwoFactorLogin(input: {
  token?: string;
  code: string;
  ip: string;
  userAgent: string;
}) {
  const challenge = await getTwoFactorChallenge(input.token);
  if (!challenge || challenge.purpose !== "verify") {
    throw new ApiError(
      401,
      "TWO_FACTOR_REQUIRED",
      "Enter your password again to continue two-factor authentication",
    );
  }

  const loaded = await loadUserById(challenge.userId);
  if (!loaded) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
  }

  const usedRecovery = await consumeRecoveryOrTotp(loaded, input.code, input.ip);
  await consumeTwoFactorChallenge(input.token);
  await destroyAllUserSessions(loaded.id);

  const session = await createUserSession(
    loaded,
    { ip: input.ip, userAgent: input.userAgent },
    { twoFactorVerified: true },
  );

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, loaded.id));

  await writeAuditLog({
    actor: { userId: loaded.id, roleKey: loaded.roleKey, permissions: [] },
    action: usedRecovery
      ? "account.two_factor_recovery_used"
      : "account.two_factor_verified",
    entityType: "user",
    entityId: loaded.id,
    ipAddress: input.ip,
  });
  await safeRecordPresence({
    userId: loaded.id,
    kind: "login",
    ipAddress: input.ip,
  });

  return { user: loaded, session };
}

export async function regenerateRecoveryCodes(input: {
  user: SessionUser;
  code: string;
  ip: string;
}) {
  if (!(await isTotpEnabled(input.user.id))) {
    throw new ApiError(400, "TWO_FACTOR_REQUIRED", "Set up an authenticator first");
  }

  await consumeRecoveryOrTotp(input.user, input.code, input.ip, {
    allowRecovery: false,
  });

  const recoveryCodes = generateRecoveryCodes();
  await db.transaction(async (tx) => {
    await tx
      .delete(totpRecoveryCodes)
      .where(eq(totpRecoveryCodes.userId, input.user.id));
    await tx.insert(totpRecoveryCodes).values(
      recoveryCodes.map((code) => ({
        userId: input.user.id,
        codeHash: hashRecoveryCode(code),
      })),
    );
  });

  await writeAuditLog({
    actor: { userId: input.user.id, roleKey: input.user.roleKey, permissions: [] },
    action: "account.two_factor_recovery_regenerated",
    entityType: "user",
    entityId: input.user.id,
    ipAddress: input.ip,
  });

  return { recoveryCodes };
}

export async function getTwoFactorStatus(user: SessionUser) {
  const enabled = await isTotpEnabled(user.id);
  const remaining = enabled
    ? (
        await db
          .select({ id: totpRecoveryCodes.id })
          .from(totpRecoveryCodes)
          .where(
            and(
              eq(totpRecoveryCodes.userId, user.id),
              isNull(totpRecoveryCodes.usedAt),
            ),
          )
      ).length
    : 0;

  return {
    required: requiresTwoFactor(user.roleKey),
    enabled,
    remainingRecoveryCodes: remaining,
  };
}

export async function resolveEnrollmentUser(
  actorUserId: string | undefined,
  challengeToken?: string,
) {
  if (actorUserId) {
    const user = await loadUserById(actorUserId);
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
    }
    return user;
  }

  const challenge = await getTwoFactorChallenge(challengeToken);
  if (!challenge || challenge.purpose !== "enroll") {
    throw new ApiError(
      401,
      "TWO_FACTOR_REQUIRED",
      "Enter your password again to set up two-factor authentication",
    );
  }

  return challengeToUser(challenge);
}

export function challengeToUser(challenge: TwoFactorChallenge): SessionUser {
  return {
    id: challenge.userId,
    email: challenge.email,
    displayName: challenge.displayName,
    roleKey: challenge.roleKey,
    status: "active",
    locale: challenge.locale ?? "en",
    currency: challenge.currency ?? null,
    country: challenge.country ?? null,
    emailVerifiedAt: new Date(),
    lastLoginAt: null,
  };
}

async function consumeRecoveryOrTotp(
  user: SessionUser,
  code: string,
  ip: string,
  options?: { allowRecovery?: boolean },
) {
  const allowRecovery = options?.allowRecovery !== false;
  const [row] = await db
    .select()
    .from(userTotp)
    .where(eq(userTotp.userId, user.id))
    .limit(1);

  if (!row) {
    throw new ApiError(400, "TWO_FACTOR_REQUIRED", "Set up an authenticator first");
  }

  const totp = verifyTotpCode(decryptTotpSecret(row.secretEncrypted), code, row.lastUsedStep);
  if (totp.ok) {
    await db
      .update(userTotp)
      .set({ lastUsedStep: totp.step })
      .where(eq(userTotp.userId, user.id));
    return false;
  }

  const recovery = allowRecovery ? normalizeRecoveryCode(code) : null;
  if (recovery) {
    const [match] = await db
      .select()
      .from(totpRecoveryCodes)
      .where(
        and(
          eq(totpRecoveryCodes.userId, user.id),
          eq(totpRecoveryCodes.codeHash, hashRecoveryCode(recovery)),
          isNull(totpRecoveryCodes.usedAt),
        ),
      )
      .limit(1);

    if (match) {
      await db
        .update(totpRecoveryCodes)
        .set({ usedAt: new Date() })
        .where(eq(totpRecoveryCodes.id, match.id));
      return true;
    }
  }

  await recordFailedLogin(user.email, ip).catch(() => undefined);
  await writeAuditLog({
    actor: { userId: user.id, roleKey: user.roleKey, permissions: [] },
    action: "account.two_factor_failed",
    entityType: "user",
    entityId: user.id,
    ipAddress: ip,
  });
  throw new ApiError(401, "INVALID_CODE", "That authenticator code is incorrect");
}

