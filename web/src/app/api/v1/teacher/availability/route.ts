import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  availabilitySettingsSchema,
  upsertAvailabilitySchema,
} from "@/server/booking/schemas";
import {
  addDatedAvailability,
  addRecurringAvailability,
  listTeacherAvailability,
  setTeacherAvailabilitySettings,
} from "@/server/booking/availability";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can manage availability");
    }
    return listTeacherAvailability(actor!.userId);
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: upsertAvailabilitySchema,
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can manage availability");
    }
    if (input.kind === "recurring" || input.kind === "break") {
      return addRecurringAvailability(actor!, input, ip);
    }
    return addDatedAvailability(actor!, input, ip);
  },
);

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: availabilitySettingsSchema,
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can manage availability");
    }
    return setTeacherAvailabilitySettings(actor!, input, ip);
  },
);
