import { authResponse, currencyCookie } from "@/server/auth/cookies";
import { apiRoute } from "@/server/api/handler";
import {
  getCurrenciesFaculty,
  getRequestMoney,
  setPreferredCurrency,
} from "@/server/money/currency";
import { setPreferredCurrencySchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const GET = apiRoute({ auth: "public", rateLimit: "public" }, async () => {
  const [money, faculty] = await Promise.all([
    getRequestMoney(),
    getCurrenciesFaculty(),
  ]);
  return {
    currency: money.currency,
    currencies: money.currencies,
    faculty,
  };
});

export const POST = apiRoute(
  {
    auth: "public",
    csrf: true,
    rateLimit: "sensitive",
    input: setPreferredCurrencySchema,
  },
  async ({ input, actor, requestId }) => {
    const currency = await setPreferredCurrency(input.currency, actor);
    return authResponse(requestId, { currency }, [currencyCookie(currency.code)]);
  },
);
