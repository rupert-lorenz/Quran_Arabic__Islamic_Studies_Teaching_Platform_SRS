import { apiRoute } from "@/server/api/handler";
import { TWO_FACTOR_COOKIE_NAME } from "@/server/api/constants";
import { getCookie } from "@/server/api/request";
import { readTwoFactorChallenge } from "@/server/auth/two-factor";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "public", rateLimit: "sensitive" },
  async ({ request }) =>
    readTwoFactorChallenge(getCookie(request, TWO_FACTOR_COOKIE_NAME)),
);
