import { apiRoute } from "@/server/api/handler";
import { TWO_FACTOR_COOKIE_NAME } from "@/server/api/constants";
import { getCookie } from "@/server/api/request";
import { beginTwoFactorSetup, resolveEnrollmentUser } from "@/server/auth/two-factor";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "public", csrf: true, rateLimit: "sensitive" },
  async ({ request, actor }) => {
    const user = await resolveEnrollmentUser(
      actor?.userId,
      getCookie(request, TWO_FACTOR_COOKIE_NAME),
    );
    return beginTwoFactorSetup(user);
  },
);
