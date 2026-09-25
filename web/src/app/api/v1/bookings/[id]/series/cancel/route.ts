import { ApiError } from "@/server/api/errors";
import { apiRoute } from "@/server/api/handler";
import { cancelBookingSchema } from "@/server/booking/schemas";
import { cancelBookingSeries } from "@/server/booking/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: cancelBookingSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Booking id is required");
    }
    return cancelBookingSeries(actor!, params.id, input, ip);
  },
);
