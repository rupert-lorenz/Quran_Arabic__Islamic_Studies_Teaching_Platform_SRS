import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import { resolveSessionToken } from "@/server/auth/session";
import { isTotpEnabled } from "@/server/auth/two-factor-status";
import { getEffectivePermissions } from "@/server/rbac/effective";
import { ApiError } from "./errors";
import { bearerToken } from "./mobile-client";
import { getCookie, SESSION_COOKIE_NAME } from "./request";

export type ApiActor = {
  userId: string;
  roleKey: string;
  permissions: string[];
  displayName?: string;
  email?: string;
  status?: string;
  twoFactorPending?: boolean;
};

export async function getActor(request: Request): Promise<ApiActor | null> {
  const token = getCookie(request, SESSION_COOKIE_NAME) || bearerToken(request);
  if (!token) {
    return null;
  }

  const user = await resolveSessionToken(token);
  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    roleKey: user.roleKey,
    permissions: await getEffectivePermissions(user.id, user.roleKey),
    displayName: user.displayName,
    email: user.email,
    status: user.status,
    twoFactorPending:
      isStaffRole(user.roleKey) && !(await isTotpEnabled(user.id)),
  };
}

export function requireActor(actor: ApiActor | null): ApiActor {
  if (!actor) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
  }

  return actor;
}

export function requirePermission(actor: ApiActor, permission: string | string[]) {
  if (actor.twoFactorPending) {
    throw new ApiError(
      403,
      "TWO_FACTOR_REQUIRED",
      "Set up two-factor authentication to continue",
    );
  }

  if (hasAnyPermission(actor, permission)) {
    return;
  }

  throw new ApiError(403, "FORBIDDEN", "You do not have permission for this action");
}
