import { apiRoute } from "@/server/api/handler";
import { deleteAccountSchema, deleteOwnAccount } from "@/server/security/privacy";
import { authResponse, clearSessionCookie, clearTwoFactorCookie } from "@/server/auth/cookies";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    csrf: true,
    rateLimit: "sensitive",
    input: deleteAccountSchema,
  },
  async ({ actor, requestId, ip }) => {
    await deleteOwnAccount(actor!, ip);
    return authResponse(requestId, { deleted: true }, [
      clearSessionCookie(),
      clearTwoFactorCookie(),
    ]);
  },
);
