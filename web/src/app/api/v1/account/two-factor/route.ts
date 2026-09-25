import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { loadUserById } from "@/server/auth/session";
import { getTwoFactorStatus } from "@/server/auth/two-factor";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => {
    const user = await loadUserById(actor!.userId);
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
    }
    return getTwoFactorStatus(user);
  },
);
