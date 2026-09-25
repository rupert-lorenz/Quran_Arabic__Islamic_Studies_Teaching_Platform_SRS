import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { twoFactorCodeSchema } from "@/server/auth/schemas";
import { loadUserById } from "@/server/auth/session";
import { regenerateRecoveryCodes } from "@/server/auth/two-factor";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: twoFactorCodeSchema,
  },
  async ({ actor, input, ip }) => {
    const user = await loadUserById(actor!.userId);
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
    }

    return regenerateRecoveryCodes({
      user,
      code: input.code,
      ip,
    });
  },
);
