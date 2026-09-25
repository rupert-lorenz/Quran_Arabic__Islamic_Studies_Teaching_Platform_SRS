import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { getConfig } from "@/server/config";
import { getEffectivePermissions } from "@/server/rbac/effective";
import { finalizeSignIn, publicUser } from "./login";
import { isTotpEnabled } from "./two-factor-status";
import { isStaffRole } from "@/lib/rbac";
import { sendAccountEmail } from "./mail";
import { hashPassword, normalizeEmail, verifyPassword } from "./password";
import {
  createUserSession,
  destroyAllUserSessions,
  loadUserById,
  type SessionUser,
} from "./session";
import { accountActionUrl, consumeAccountToken, issueAccountToken } from "./tokens";

export async function verifyEmailAddress(token: string, meta: { ip: string; userAgent: string }) {
  const consumed = await consumeAccountToken(token, "email_verify");
  if (!consumed) {
    throw new ApiError(400, "INVALID_TOKEN", "This verification link is invalid or has expired");
  }

  const [row] = await db
    .select({ roleKey: roles.key })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, consumed.userId))
    .limit(1);

  const nextStatus = row?.roleKey === "teacher" ? "pending" : "active";

  await db
    .update(users)
    .set({
      emailVerifiedAt: new Date(),
      status: nextStatus,
    })
    .where(eq(users.id, consumed.userId));

  const user = await loadUserById(consumed.userId);
  if (!user) {
    throw new ApiError(400, "INVALID_TOKEN", "This verification link is invalid or has expired");
  }

  await writeAuditLog({
    actor: { userId: user.id, roleKey: user.roleKey, permissions: [] },
    action: "account.email_verified",
    entityType: "user",
    entityId: user.id,
    ipAddress: meta.ip,
  });

  return finalizeSignIn(user, meta);
}

export async function requestPasswordReset(email: string) {
  const normalized = normalizeEmail(email);
  const [row] = await db
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (row && !row.deletedAt) {
    const token = await issueAccountToken(row.id, "password_reset");
    const resetUrl = accountActionUrl("/reset-password", token);
    await sendAccountEmail({
      to: normalized,
      subject: "Reset your password",
      text: `Reset your password by opening this link: ${resetUrl}`,
    });

    return {
      sent: true,
      resetUrl: getConfig().isDevelopment ? resetUrl : undefined,
    };
  }

  return { sent: true };
}

export async function resetPassword(token: string, password: string, ip: string) {
  const consumed = await consumeAccountToken(token, "password_reset");
  if (!consumed) {
    throw new ApiError(400, "INVALID_TOKEN", "This reset link is invalid or has expired");
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, consumed.userId));

  await destroyAllUserSessions(consumed.userId);
  await writeAuditLog({
    actor: { userId: consumed.userId, roleKey: "student", permissions: [] },
    action: "account.password_reset",
    entityType: "user",
    entityId: consumed.userId,
    ipAddress: ip,
  });
}

export async function changePassword(
  user: SessionUser,
  input: { currentPassword: string; newPassword: string; ip: string; userAgent: string },
) {
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row || !(await verifyPassword(input.currentPassword, row.passwordHash))) {
    throw new ApiError(400, "INVALID_PASSWORD", "Current password is incorrect");
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.newPassword) })
    .where(eq(users.id, user.id));

  await destroyAllUserSessions(user.id);
  const session = await createUserSession(
    user,
    {
      ip: input.ip,
      userAgent: input.userAgent,
    },
    {
      twoFactorVerified:
        isStaffRole(user.roleKey) && (await isTotpEnabled(user.id)),
    },
  );

  await writeAuditLog({
    actor: { userId: user.id, roleKey: user.roleKey, permissions: [] },
    action: "account.password_changed",
    entityType: "user",
    entityId: user.id,
    ipAddress: input.ip,
  });

  return session;
}

export async function updateDisplayName(user: SessionUser, displayName: string) {
  const name = displayName.trim();
  if (name.length < 2) {
    throw new ApiError(422, "VALIDATION", "Display name is too short");
  }

  await db.update(users).set({ displayName: name }).where(eq(users.id, user.id));
  return publicUser(
    { ...user, displayName: name },
    await getEffectivePermissions(user.id, user.roleKey),
  );
}
