import { apiRoute } from "@/server/api/handler";
import { createBookingSchema } from "@/server/booking/schemas";
import { createBookings, listActorBookings } from "@/server/booking/service";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => listActorBookings(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: createBookingSchema,
  },
  async ({ actor, input, ip }) => createBookings(actor!, input, ip),
);
