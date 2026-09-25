import { apiRoute } from "@/server/api/handler";
import { getCookie, SESSION_COOKIE_NAME } from "@/server/api/request";
import { writeAuditLog } from "@/server/api/audit";
import { safeRecordPresence } from "@/server/lms/presence";
import {
  authResponse,
  clearSessionCookie,
  clearTwoFactorCookie,
} from "@/server/auth/cookies";
import { destroyCurrentSession } from "@/server/auth/session";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "public", csrf: true, rateLimit: "sensitive" },
  async ({ request, requestId, actor, ip }) => {
    await destroyCurrentSession(getCookie(request, SESSION_COOKIE_NAME));
    if (actor) {
      await writeAuditLog({
        actor,
        action: "account.logout",
        entityType: "user",
        entityId: actor.userId,
        ipAddress: ip,
      });
      await safeRecordPresence({
        userId: actor.userId,
        kind: "logout",
        ipAddress: ip,
      });
    }

    return authResponse(requestId, { signedOut: true }, [
      clearSessionCookie(),
      clearTwoFactorCookie(),
    ]);
  },
);
