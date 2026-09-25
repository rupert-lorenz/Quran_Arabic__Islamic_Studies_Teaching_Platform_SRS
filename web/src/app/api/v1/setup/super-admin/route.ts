import { apiRoute } from "@/server/api/handler";
import {
  authResponse,
  clearSessionCookie,
  clearTwoFactorCookie,
  sessionCookie,
  twoFactorCookie,
} from "@/server/auth/cookies";
import { publicUser } from "@/server/auth/login";
import { bootstrapSuperAdminSchema } from "@/server/auth/schemas";
import { getConfig } from "@/server/config";
import { getEffectivePermissions } from "@/server/rbac/effective";
import { bootstrapSuperAdmin } from "@/server/staff/accounts";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "public",
    csrf: true,
    rateLimit: "sensitive",
    input: bootstrapSuperAdminSchema,
  },
  async ({ input, ip, userAgent, requestId }) => {
    const result = await bootstrapSuperAdmin({
      ...input,
      ip,
      userAgent,
    });

    const user = publicUser(
      result.user,
      await getEffectivePermissions(result.user.id, result.user.roleKey),
      { twoFactorEnabled: Boolean(result.twoFactor?.enrolled) },
    );

    if (result.twoFactor) {
      return authResponse(
        requestId,
        {
          user,
          twoFactor: {
            required: true,
            enrolled: result.twoFactor.enrolled,
          },
        },
        [twoFactorCookie(result.twoFactor.challengeToken), clearSessionCookie()],
      );
    }

    return authResponse(
      requestId,
      { user },
      [
        sessionCookie(result.session!.token, getConfig().sessionTtlSeconds),
        clearTwoFactorCookie(),
      ],
    );
  },
);
