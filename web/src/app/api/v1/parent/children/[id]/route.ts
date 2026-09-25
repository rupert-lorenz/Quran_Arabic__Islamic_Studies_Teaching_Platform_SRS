import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  getManagedParentChild,
  removeParentChild,
  updateParentChild,
} from "@/server/parent/children";
import { updateParentChildSchema } from "@/server/parent/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(403, "FORBIDDEN", "Only parents can view children");
    }
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Child id is required");
    }
    return getManagedParentChild(actor!.userId, params.id);
  },
);

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: updateParentChildSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(403, "FORBIDDEN", "Only parents can update children");
    }
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Child id is required");
    }
    return updateParentChild(actor!, params.id, input, ip);
  },
);

export const DELETE = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params, ip }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(403, "FORBIDDEN", "Only parents can remove children");
    }
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Child id is required");
    }
    return removeParentChild(actor!, params.id, ip);
  },
);
