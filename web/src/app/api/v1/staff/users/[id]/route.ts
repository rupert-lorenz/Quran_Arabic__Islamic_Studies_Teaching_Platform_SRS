import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateStaffUserSchema } from "@/server/auth/schemas";
import { updateDirectoryUser } from "@/server/staff/accounts";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: ["users.write", "users.suspend"],
    rateLimit: "sensitive",
    input: updateStaffUserSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "User id is required");
    }

    return updateDirectoryUser(actor!, params.id, { ...input, ip });
  },
);
