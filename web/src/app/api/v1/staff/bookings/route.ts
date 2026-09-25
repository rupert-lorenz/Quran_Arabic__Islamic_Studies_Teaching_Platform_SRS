import { apiRoute } from "@/server/api/handler";
import { listActorBookings } from "@/server/booking/service";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["classes.manage", "teachers.approve"],
    rateLimit: "sensitive",
  },
  async ({ actor }) => listActorBookings(actor!),
);
