import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  addMaterialAccessRule,
  getMaterialAccess,
  grantMaterialAccess,
  removeMaterialAccessRule,
  revokeMaterialAccess,
} from "@/server/lms/entitlements";
import { libraryEntitlementActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Material id is required");
    }
    return getMaterialAccess(actor!, params.id);
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: libraryEntitlementActionSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Material id is required");
    }
    if (input.action === "add_rule") {
      return addMaterialAccessRule(actor!, params.id, input, ip);
    }
    if (input.action === "remove_rule") {
      return removeMaterialAccessRule(actor!, params.id, input.ruleId, ip);
    }
    if (input.action === "grant") {
      return grantMaterialAccess(actor!, params.id, input, ip);
    }
    return revokeMaterialAccess(actor!, params.id, input.grantId, ip);
  },
);
