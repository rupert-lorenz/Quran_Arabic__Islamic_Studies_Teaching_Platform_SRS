import { z } from "zod";
import { apiRoute } from "@/server/api/handler";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { replaceRolePermissions } from "@/server/rbac/update";

export const runtime = "nodejs";

const updateSchema = z.object({
  keys: z.array(z.string().min(1).max(80)).max(200),
});

export const PUT = apiRoute(
  {
    auth: "session",
    permission: "rbac.write",
    rateLimit: "sensitive",
    input: updateSchema,
  },
  async ({ input, params, actor, ip }) => {
    if (!params.key) {
      throw new ApiError(400, "VALIDATION", "Role key is required");
    }
    const result = await replaceRolePermissions(params.key, input.keys);
    await writeAuditLog({
      actor,
      action: "rbac.role_permissions_updated",
      entityType: "role",
      entityId: params.key,
      ipAddress: ip,
      metadata: { permissions: result.permissions },
    });
    return result;
  },
);
