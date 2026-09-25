import { apiRoute } from "@/server/api/handler";
import { requireWebhookSignature } from "@/server/integrations";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "public", csrf: false, rateLimit: "webhook" },
  async ({ request }) => {
    const payload = await request.text();
    requireWebhookSignature(
      payload,
      request.headers.get("x-webhook-signature"),
      process.env.PAYMENTS_WEBHOOK_SECRET,
    );

    return { received: true };
  },
);
