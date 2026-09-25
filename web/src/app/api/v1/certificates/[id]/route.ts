import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getCertificateAward } from "@/server/lms/certificates";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Certificate id is required");
    }
    return getCertificateAward(actor!, params.id);
  },
);
