import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { isParentManagedStudent } from "@/server/parent/children";
import { isStaffRole } from "@/lib/rbac";
import { writeAuditLog } from "@/server/api/audit";
import { safeRecordPresence } from "@/server/lms/presence";
import { ApiError } from "@/server/api/errors";
import { clearFailedLogins, assertNotLocked, recordFailedLogin } from "./lockout";
import { normalizeEmail, verifyPasswordOrDummy } from "./password";
import { createUserSession, type SessionUser } from "./session";
import { requiresTwoFactor, startTwoFactorChallenge } from "./two-factor";

const genericLoginError = new ApiError(
  401,
  "INVALID_CREDENTIALS",
  "Email or password is incorrect",
);

export async function authenticateUser(input: {
  email: string;
  password: string;
  ip: string;
  userAgent: string;
}) {
  const email = normalizeEmail(input.email);
  await assertNotLocked(email, input.ip);

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      passwordHash: users.passwordHash,
      status: users.status,
      emailVerifiedAt: users.emailVerifiedAt,
      lastLoginAt: users.lastLoginAt,
      locale: users.locale,
      currency: users.currency,
      country: users.country,
      deletedAt: users.deletedAt,
      roleKey: roles.key,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email))
    .limit(1);

  const passwordOk = await verifyPasswordOrDummy(input.password, row?.passwordHash);

  if (!row || row.deletedAt || !passwordOk) {
    await recordFailedLogin(email, input.ip).catch(() => undefined);
    await writeAuditLog({
      actor: null,
      action: "account.login_failed",
      entityType: "user",
      entityId: email,
      ipAddress: input.ip,
    });
    throw genericLoginError;
  }

  if (row.status === "suspended") {
    throw new ApiError(
      403,
      "ACCOUNT_DISABLED",
      "This account is suspended. Contact support if you need it restored.",
    );
  }
  if (row.status === "rejected") {
    throw new ApiError(403, "ACCOUNT_DISABLED", "This account is not available");
  }

  if (!row.emailVerifiedAt) {
    throw new ApiError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Verify your email before signing in",
    );
  }

  if (row.roleKey === "student" && (await isParentManagedStudent(row.id))) {
    throw new ApiError(
      403,
      "PARENT_MANAGED",
      "This learner is managed by a parent account. Sign in with the parent or guardian email.",
    );
  }

  const user: SessionUser = {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    roleKey: row.roleKey,
    status: row.status,
    locale: row.locale,
    currency: row.currency,
    country: row.country,
    emailVerifiedAt: row.emailVerifiedAt,
    lastLoginAt: row.lastLoginAt,
  };

  return finalizeSignIn(user, input);
}

export async function finalizeSignIn(
  user: SessionUser,
  meta: { ip: string; userAgent: string },
) {
  if (requiresTwoFactor(user.roleKey)) {
    const challenge = await startTwoFactorChallenge(user, meta.ip);
    return {
      user,
      twoFactor: {
        required: true as const,
        enrolled: challenge.enrolled,
        challengeToken: challenge.token,
      },
    };
  }

  const session = await createUserSession(user, {
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  await clearFailedLogins(user.email, meta.ip).catch(() => undefined);
  await writeAuditLog({
    actor: { userId: user.id, roleKey: user.roleKey, permissions: [] },
    action: "account.login",
    entityType: "user",
    entityId: user.id,
    ipAddress: meta.ip,
  });
  await safeRecordPresence({
    userId: user.id,
    kind: "login",
    ipAddress: meta.ip,
  });

  return { user, session };
}

export function publicUser(
  user: SessionUser,
  permissions: string[] = [],
  extras?: { twoFactorEnabled?: boolean; onboardingRequired?: boolean },
) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roleKey: user.roleKey,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    permissions,
    twoFactorRequired: isStaffRole(user.roleKey),
    twoFactorEnabled: extras?.twoFactorEnabled ?? false,
    onboardingRequired: extras?.onboardingRequired ?? false,
  };
}
