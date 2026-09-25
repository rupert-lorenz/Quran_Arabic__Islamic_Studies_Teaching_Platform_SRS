import { apiRoute } from "@/server/api/handler";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { updateUserPermissionsSchema } from "@/server/auth/schemas";
import {
  getUserPermissionState,
  replaceUserPermissions,
} from "@/server/rbac/user-permissions";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", permission: "rbac.read", rateLimit: "sensitive" },
  async ({ params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "User id is required");
    }
    return getUserPermissionState(params.id);
  },
);

export const PUT = apiRoute(
  {
    auth: "session",
    permission: "rbac.write",
    rateLimit: "sensitive",
    input: updateUserPermissionsSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "User id is required");
    }

    if (actor!.userId === params.id) {
      throw new ApiError(
        400,
        "ROLE_LOCKED",
        "You cannot change your own permission set",
      );
    }

    const result = await replaceUserPermissions(params.id, input);
    await writeAuditLog({
      actor,
      action: "users.permissions_updated",
      entityType: "user",
      entityId: params.id,
      ipAddress: ip,
      metadata: { mode: result.mode, permissions: result.permissions },
    });
    return result;
  },
);
