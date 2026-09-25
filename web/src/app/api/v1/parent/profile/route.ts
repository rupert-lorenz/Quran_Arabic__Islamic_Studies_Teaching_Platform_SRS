import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  getManagedParentProfile,
  updateManagedParentProfile,
} from "@/server/parent/profile";
import { updateParentProfileSchema } from "@/server/parent/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(403, "FORBIDDEN", "Only parents can view this profile");
    }
    return getManagedParentProfile(actor!.userId);
  },
);

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: updateParentProfileSchema,
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only parents can update this profile",
      );
    }
    return updateManagedParentProfile(actor!, input, ip);
  },
);
