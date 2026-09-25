import { authResponse, localeCookie } from "@/server/auth/cookies";
import { apiRoute } from "@/server/api/handler";
import { getI18n, setPreferredLocale } from "@/server/i18n/locale";
import { setPreferredLocaleSchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const GET = apiRoute({ auth: "public", rateLimit: "public" }, async () => {
  const i18n = await getI18n();
  return {
    locale: i18n.locale,
    locales: i18n.locales,
  };
});

export const POST = apiRoute(
  {
    auth: "public",
    csrf: true,
    rateLimit: "sensitive",
    input: setPreferredLocaleSchema,
  },
  async ({ input, actor, requestId }) => {
    const locale = await setPreferredLocale(input.locale, actor);
    return authResponse(requestId, { locale }, [localeCookie(locale.code)]);
  },
);
