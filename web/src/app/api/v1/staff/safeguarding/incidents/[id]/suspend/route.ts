import { hasAnyPermission } from "@/lib/rbac";
import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { suspendInvolvedUser } from "@/server/staff/safeguarding";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    permission: "users.suspend",
    rateLimit: "sensitive",
  },
  async ({ actor, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Incident id is required");
    }
    if (!hasAnyPermission(actor!, "safeguarding.incidents")) {
      throw new ApiError(403, "FORBIDDEN", "You cannot suspend from an incident");
    }
    return suspendInvolvedUser(actor!, params.id, ip);
  },
);
