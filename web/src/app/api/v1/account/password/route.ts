import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { changePassword } from "@/server/auth/account";
import { authResponse, sessionCookie } from "@/server/auth/cookies";
import { changePasswordSchema } from "@/server/auth/schemas";
import { loadUserById } from "@/server/auth/session";
import { getConfig } from "@/server/config";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "session", rateLimit: "sensitive", input: changePasswordSchema },
  async ({ actor, input, ip, userAgent, requestId }) => {
    const user = await loadUserById(actor!.userId);
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
    }

    const session = await changePassword(user, {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      ip,
      userAgent,
    });

    return authResponse(
      requestId,
      { updated: true },
      [sessionCookie(session.token, getConfig().sessionTtlSeconds)],
    );
  },
);
