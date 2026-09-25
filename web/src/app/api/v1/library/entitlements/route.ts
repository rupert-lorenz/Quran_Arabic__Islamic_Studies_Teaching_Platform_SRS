import { apiRoute } from "@/server/api/handler";
import {
  assignLibraryLicence,
  assignLibrarySubscription,
  createLibraryLicencePool,
  createLibraryPlan,
  listLibraryAccessCatalog,
} from "@/server/lms/entitlements";
import { libraryCatalogActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async () => listLibraryAccessCatalog(),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: libraryCatalogActionSchema,
  },
  async ({ actor, input, ip }) => {
    if (input.action === "create_plan") {
      return createLibraryPlan(actor!, input, ip);
    }
    if (input.action === "create_pool") {
      return createLibraryLicencePool(actor!, input, ip);
    }
    if (input.action === "assign_subscription") {
      return assignLibrarySubscription(actor!, input, ip);
    }
    return assignLibraryLicence(actor!, input, ip);
  },
);
