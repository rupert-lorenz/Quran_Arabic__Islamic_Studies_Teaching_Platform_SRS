import { apiRoute } from "@/server/api/handler";
import { TWO_FACTOR_COOKIE_NAME } from "@/server/api/constants";
import { bearerToken, mobileClient } from "@/server/api/mobile-client";
import { getCookie } from "@/server/api/request";
import {
  authResponse,
  clearTwoFactorCookie,
  sessionCookie,
} from "@/server/auth/cookies";
import { publicUser } from "@/server/auth/login";
import { twoFactorCodeSchema } from "@/server/auth/schemas";
import { verifyTwoFactorLogin } from "@/server/auth/two-factor";
import { getConfig } from "@/server/config";
import { getEffectivePermissions } from "@/server/rbac/effective";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "public",
    csrf: true,
    rateLimit: "sensitive",
    input: twoFactorCodeSchema,
  },
  async ({ input, request, ip, userAgent, requestId }) => {
    const native = mobileClient(request);
    const { user, session } = await verifyTwoFactorLogin({
      token: getCookie(request, TWO_FACTOR_COOKIE_NAME) || bearerToken(request) || undefined,
      code: input.code,
      ip,
      userAgent,
    });

    return authResponse(
      requestId,
      {
        user: publicUser(user, await getEffectivePermissions(user.id, user.roleKey), {
          twoFactorEnabled: true,
        }),
        ...(native ? { sessionToken: session.token, client: native } : {}),
      },
      [
        sessionCookie(session.token, getConfig().sessionTtlSeconds),
        clearTwoFactorCookie(),
      ],
    );
  },
);
