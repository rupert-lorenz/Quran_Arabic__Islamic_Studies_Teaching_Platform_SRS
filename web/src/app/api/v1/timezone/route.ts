import { authResponse, timezoneCookie } from "@/server/auth/cookies";
import { apiRoute } from "@/server/api/handler";
import {
  resolveDisplayTimeZone,
  setPreferredTimeZone,
} from "@/server/booking/policy";
import { timezoneOptions } from "@/lib/geo";
import { setPreferredTimezoneSchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const GET = apiRoute({ auth: "public", rateLimit: "public" }, async ({ actor }) => {
  const timeZone = await resolveDisplayTimeZone(actor?.userId);
  return {
    timeZone,
    timezones: timezoneOptions(timeZone),
  };
});

export const POST = apiRoute(
  {
    auth: "public",
    csrf: true,
    rateLimit: "sensitive",
    input: setPreferredTimezoneSchema,
  },
  async ({ input, actor, requestId }) => {
    const result = await setPreferredTimeZone(input.timeZone, actor, input.persist);
    return authResponse(requestId, result, [timezoneCookie(result.timeZone)]);
  },
);
