import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { signTeacherAgreementSchema } from "@/server/teacher/schemas";
import { signTeacherAgreement } from "@/server/teacher/onboarding";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: signTeacherAgreementSchema,
  },
  async ({ actor, input, ip, userAgent }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can sign the agreement");
    }
    return signTeacherAgreement(actor!, input, { ip, userAgent });
  },
);
