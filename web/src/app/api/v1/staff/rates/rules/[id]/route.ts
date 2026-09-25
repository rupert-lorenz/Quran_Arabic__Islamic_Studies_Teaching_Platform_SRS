import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { removeTeacherPricingControl } from "@/server/staff/rates";

export const runtime = "nodejs";

export const DELETE = apiRoute(
  {
    auth: "session",
    permission: ["settings.write", "teachers.approve"],
    rateLimit: "sensitive",
  },
  async ({ actor, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Pricing control id is required");
    }
    return removeTeacherPricingControl(actor!, params.id, ip);
  },
);
