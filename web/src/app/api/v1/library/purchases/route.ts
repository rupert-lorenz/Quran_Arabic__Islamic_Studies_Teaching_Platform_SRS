import { apiRoute } from "@/server/api/handler";
import {
  assignLibraryPurchase,
  listLibraryPurchaseDesk,
  revokeLibraryPurchase,
  setMaterialPurchasable,
} from "@/server/lms/purchases";
import { libraryPurchaseActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listLibraryPurchaseDesk(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: libraryPurchaseActionSchema,
  },
  async ({ actor, input, ip }) => {
    if (input.action === "set_purchasable") {
      return setMaterialPurchasable(actor!, input, ip);
    }
    if (input.action === "assign") {
      return assignLibraryPurchase(actor!, input, ip);
    }
    return revokeLibraryPurchase(actor!, input, ip);
  },
);
