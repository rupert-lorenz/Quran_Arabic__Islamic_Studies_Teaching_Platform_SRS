import { apiRoute } from "@/server/api/handler";
import { loadUserById } from "@/server/auth/session";
import { publicUser } from "@/server/auth/login";
import { ApiError } from "@/server/api/errors";
import { isStaffRole } from "@/lib/rbac";
import { getEffectivePermissions } from "@/server/rbac/effective";

export const runtime = "nodejs";

export const GET = apiRoute({ auth: "session", rateLimit: "sensitive" }, async ({ actor }) => {
  const user = await loadUserById(actor!.userId);
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
  }

  return publicUser(
    user,
    actor?.permissions ?? (await getEffectivePermissions(user.id, user.roleKey)),
    {
      twoFactorEnabled:
        isStaffRole(user.roleKey) && !actor?.twoFactorPending,
    },
  );
});
