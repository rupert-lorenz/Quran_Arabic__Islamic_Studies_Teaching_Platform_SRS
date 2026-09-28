import { apiRoute } from "@/server/api/handler";
import { getPaymentsFinanceDesk } from "@/server/finance/service";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => getPaymentsFinanceDesk(actor!),
);
