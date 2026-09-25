import { apiRoute } from "@/server/api/handler";
import { listCurrencyWorkspace, upsertFxRate } from "@/server/staff/currencies";
import { upsertFxRateSchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["settings.write", "payments.read"],
    rateLimit: "sensitive",
  },
  async ({ actor }) => listCurrencyWorkspace(actor!),
);

export const PUT = apiRoute(
  {
    auth: "session",
    permission: "settings.write",
    rateLimit: "sensitive",
    input: upsertFxRateSchema,
  },
  async ({ actor, input, ip }) => upsertFxRate(actor!, input, ip),
);
