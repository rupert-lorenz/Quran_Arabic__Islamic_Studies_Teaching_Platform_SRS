import { apiRoute } from "@/server/api/handler";
import { updateDisplayName } from "@/server/auth/account";
import { updateAccountSchema } from "@/server/auth/schemas";
import { loadUserById } from "@/server/auth/session";
import { ApiError } from "@/server/api/errors";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  { auth: "session", rateLimit: "sensitive", input: updateAccountSchema },
  async ({ actor, input }) => {
    const user = await loadUserById(actor!.userId);
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
    }

    return updateDisplayName(user, input.displayName);
  },
);
