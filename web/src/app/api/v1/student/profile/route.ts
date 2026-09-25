import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  getManagedStudentProfile,
  updateManagedStudentProfile,
} from "@/server/student/profile";
import { updateStudentProfileSchema } from "@/server/student/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => {
    if (actor!.roleKey !== "student") {
      throw new ApiError(403, "FORBIDDEN", "Only students can view this profile");
    }
    return getManagedStudentProfile(actor!.userId);
  },
);

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: updateStudentProfileSchema,
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "student") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only students can update this profile",
      );
    }
    return updateManagedStudentProfile(actor!, input, ip);
  },
);
