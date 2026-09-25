import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getActorBooking } from "@/server/booking/service";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Lesson id is required");
    }
    return getActorBooking(actor!, params.id);
  },
);
