import { apiRoute } from "@/server/api/handler";
import { cancelBookingSchema } from "@/server/booking/schemas";
import { cancelBooking } from "@/server/booking/service";
import { ApiError } from "@/server/api/errors";

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
    return cancelBooking(actor!, params.id, input, ip);
  },
);
