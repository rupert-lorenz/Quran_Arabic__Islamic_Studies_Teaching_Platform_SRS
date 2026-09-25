import { apiRoute } from "@/server/api/handler";
import { TWO_FACTOR_COOKIE_NAME } from "@/server/api/constants";
import { getCookie } from "@/server/api/request";
import {
  authResponse,
  clearTwoFactorCookie,
  sessionCookie,
} from "@/server/auth/cookies";
import { twoFactorCodeSchema } from "@/server/auth/schemas";
import {
  confirmTwoFactorSetup,
  resolveEnrollmentUser,
} from "@/server/auth/two-factor";
import { getConfig } from "@/server/config";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "public",
    csrf: true,
    rateLimit: "sensitive",
    input: twoFactorCodeSchema,
  },
  async ({ input, request, actor, ip, userAgent, requestId }) => {
    const user = await resolveEnrollmentUser(
      actor?.userId,
      getCookie(request, TWO_FACTOR_COOKIE_NAME),
    );
    const result = await confirmTwoFactorSetup({
      user,
      code: input.code,
      ip,
      userAgent,
    });

    return authResponse(
      requestId,
      { recoveryCodes: result.recoveryCodes, enabled: true },
      [
        sessionCookie(result.session.token, getConfig().sessionTtlSeconds),
        clearTwoFactorCookie(),
      ],
    );
  },
);
