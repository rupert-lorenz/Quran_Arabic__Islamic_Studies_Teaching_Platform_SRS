import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getActor } from "@/server/api/auth";
import { listSlotsQuerySchema } from "@/server/booking/schemas";
import { listTeacherSlots } from "@/server/booking/slots";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "public",
    rateLimit: "public",
    input: listSlotsQuerySchema,
  },
  async ({ request, input, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Teacher id is required");
    }
    const actor = await getActor(request);
    return listTeacherSlots(params.id, {
      ...input,
      viewerUserId: actor?.userId,
    });
  },
);
