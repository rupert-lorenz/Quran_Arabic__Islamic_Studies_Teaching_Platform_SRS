import { apiRoute } from "@/server/api/handler";
import { librarySubscriptionActionSchema } from "@/server/lms/schemas";
import {
  assignLibrarySubscriptionSeat,
  attachSubscriptionMaterial,
  createSubscriptionPlan,
  detachSubscriptionMaterial,
  endLibrarySubscription,
  extendLibrarySubscription,
  listLibrarySubscriptionDesk,
  updateSubscriptionPlan,
} from "@/server/lms/subscriptions";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listLibrarySubscriptionDesk(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: librarySubscriptionActionSchema,
  },
  async ({ actor, input, ip }) => {
    if (input.action === "create_plan") {
      return createSubscriptionPlan(actor!, input, ip);
    }
    if (input.action === "update_plan") {
      return updateSubscriptionPlan(actor!, input, ip);
    }
    if (input.action === "attach_material") {
      return attachSubscriptionMaterial(actor!, input, ip);
    }
    if (input.action === "detach_material") {
      return detachSubscriptionMaterial(actor!, input, ip);
    }
    if (input.action === "assign") {
      return assignLibrarySubscriptionSeat(actor!, input, ip);
    }
    if (input.action === "extend") {
      return extendLibrarySubscription(actor!, input, ip);
    }
    return endLibrarySubscription(actor!, input, ip);
  },
);
