import { apiRoute } from "@/server/api/handler";
import { completeBookingSchema } from "@/server/booking/schemas";
import { completeBooking } from "@/server/booking/service";
import { ApiError } from "@/server/api/errors";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: completeBookingSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Booking id is required");
    }
    return completeBooking(actor!, params.id, input.status, input.notes, ip);
  },
);
