import { apiRoute } from "@/server/api/handler";
import { rescheduleBookingSchema } from "@/server/booking/schemas";
import { rescheduleBooking } from "@/server/booking/service";
import { ApiError } from "@/server/api/errors";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: rescheduleBookingSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Booking id is required");
    }
    return rescheduleBooking(actor!, params.id, input, ip);
  },
);
