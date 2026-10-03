import { apiRoute } from "@/server/api/handler";
import { mobileClient } from "@/server/api/mobile-client";
import {
  authResponse,
  clearSessionCookie,
  clearTwoFactorCookie,
  sessionCookie,
  twoFactorCookie,
} from "@/server/auth/cookies";
import { authenticateUser, publicUser } from "@/server/auth/login";
import { loginSchema } from "@/server/auth/schemas";
import { getConfig } from "@/server/config";
import { getEffectivePermissions } from "@/server/rbac/effective";
import {
  getTeacherVerificationStatus,
  teacherNeedsOnboarding,
} from "@/server/teacher/onboarding";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "public", csrf: true, rateLimit: "sensitive", input: loginSchema },
  async ({ input, ip, userAgent, requestId, request }) => {
    const result = await authenticateUser({
      ...input,
      ip,
      userAgent,
    });

    const teacherStatus =
      result.user.roleKey === "teacher"
        ? await getTeacherVerificationStatus(result.user.id)
        : null;
    const user = publicUser(
      result.user,
      await getEffectivePermissions(result.user.id, result.user.roleKey),
      {
        twoFactorEnabled: Boolean(result.twoFactor?.enrolled),
        onboardingRequired:
          result.user.roleKey === "teacher" &&
          teacherNeedsOnboarding(teacherStatus ?? "application_started"),
      },
    );

    const native = mobileClient(request);

    if (result.twoFactor) {
      return authResponse(
        requestId,
        {
          user,
          twoFactor: {
            required: true,
            enrolled: result.twoFactor.enrolled,
            ...(native
              ? { challengeToken: result.twoFactor.challengeToken }
              : {}),
          },
        },
        [twoFactorCookie(result.twoFactor.challengeToken), clearSessionCookie()],
      );
    }

    return authResponse(
      requestId,
      {
        user,
        ...(native && result.session
          ? { sessionToken: result.session.token, client: native }
          : {}),
      },
      [
        sessionCookie(result.session!.token, getConfig().sessionTtlSeconds),
        clearTwoFactorCookie(),
      ],
    );
  },
);
