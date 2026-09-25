import { ApiError } from "@/server/api/errors";
import { apiRoute } from "@/server/api/handler";
import {
  getGroupTeachingSettings,
  setGroupTeachingSettings,
} from "@/server/booking/group-lessons";
import { groupTeachingSettingsSchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can view this setting");
    }
    return getGroupTeachingSettings(actor!.userId);
  },
);

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: groupTeachingSettingsSchema,
  },
  async ({ actor, input, ip }) =>
    setGroupTeachingSettings(actor!, input, ip),
);
