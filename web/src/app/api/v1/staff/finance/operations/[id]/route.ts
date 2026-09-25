import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateFinanceOperationSchema } from "@/server/staff/schemas";
import { updateFinanceOperation } from "@/server/staff/finance";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: ["payments.read", "payments.refund", "payouts.manage"],
    rateLimit: "sensitive",
    input: updateFinanceOperationSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Operation id is required");
    }
    return updateFinanceOperation(actor!, params.id, input, ip);
  },
);
