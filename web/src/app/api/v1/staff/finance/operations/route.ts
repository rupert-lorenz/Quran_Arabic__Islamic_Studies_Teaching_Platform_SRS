import { apiRoute } from "@/server/api/handler";
import { createFinanceOperationSchema } from "@/server/staff/schemas";
import {
  createFinanceOperation,
  listFinanceWorkspace,
} from "@/server/staff/finance";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", permission: "payments.read", rateLimit: "sensitive" },
  async () => listFinanceWorkspace(),
);

export const POST = apiRoute(
  {
    auth: "session",
    permission: ["payments.read", "payments.refund", "payouts.manage"],
    rateLimit: "sensitive",
    input: createFinanceOperationSchema,
  },
  async ({ actor, input, ip }) => createFinanceOperation(actor!, input, ip),
);
