import { apiRoute } from "@/server/api/handler";
import { verifyEmailAddress } from "@/server/auth/account";
import {
  authResponse,
  clearSessionCookie,
  clearTwoFactorCookie,
  sessionCookie,
  twoFactorCookie,
} from "@/server/auth/cookies";
import { publicUser } from "@/server/auth/login";
import { tokenSchema } from "@/server/auth/schemas";
import { getConfig } from "@/server/config";
import { getEffectivePermissions } from "@/server/rbac/effective";
import {
  getTeacherVerificationStatus,
  teacherNeedsOnboarding,
} from "@/server/teacher/onboarding";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "public", csrf: true, rateLimit: "sensitive", input: tokenSchema },
  async ({ input, ip, userAgent, requestId }) => {
    const result = await verifyEmailAddress(input.token, {
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
