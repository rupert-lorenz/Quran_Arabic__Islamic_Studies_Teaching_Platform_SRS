import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  deleteTeachingMaterial,
  getTeachingBook,
  updateTeachingMaterial,
} from "@/server/lms/library";
import { updateTeachingMaterialSchema } from "@/server/lms/schemas";

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
    return getTeachingBook(actor!, params.id);
  },
);

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: updateTeachingMaterialSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Material id is required");
    }
    return updateTeachingMaterial(actor!, params.id, input, ip);
  },
);

export const DELETE = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Material id is required");
    }
    return deleteTeachingMaterial(actor!, params.id, ip);
  },
);
