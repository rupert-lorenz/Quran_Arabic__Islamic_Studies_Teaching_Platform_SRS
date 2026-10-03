import { apiRoute } from "@/server/api/handler";
import { listCrmWorkspace } from "@/server/crm/records";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: [
      "crm.manage",
      "support.tickets",
      "reports.finance",
      "reports.academic",
      "reports.marketing",
      "users.read",
      "payments.read",
    ],
    rateLimit: "sensitive",
  },
  async ({ actor }) => listCrmWorkspace(actor!),
);
