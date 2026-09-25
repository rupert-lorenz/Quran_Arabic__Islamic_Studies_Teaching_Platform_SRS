import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateTeacherProfileSchema } from "@/server/teacher/schemas";
import {
  getManagedTeacherProfile,
  updateManagedTeacherProfile,
} from "@/server/teacher/profile";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can view this profile");
    }
    return getManagedTeacherProfile(actor!.userId);
  },
);

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: updateTeacherProfileSchema,
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can update this profile");
    }
    return updateManagedTeacherProfile(actor!, input, ip);
  },
);
