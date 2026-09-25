import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateAvailabilitySchema } from "@/server/booking/schemas";
import {
  removeAvailability,
  removeAvailabilityGroup,
  updateAvailability,
} from "@/server/booking/availability";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: updateAvailabilitySchema,
  },
  async ({ actor, input, params, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can manage availability");
    }
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Availability id is required");
    }
    return updateAvailability(actor!, params.id, input, ip);
  },
);

export const DELETE = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor, params, ip, request }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can manage availability");
    }
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Availability id is required");
    }
    const scope = new URL(request.url).searchParams.get("scope");
    if (scope === "group") {
      return removeAvailabilityGroup(actor!, params.id, ip);
    }
    return removeAvailability(actor!, params.id, ip);
  },
);
