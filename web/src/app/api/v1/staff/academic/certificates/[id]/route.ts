import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateCertificateSchema } from "@/server/staff/schemas";
import { updateCertificate } from "@/server/staff/academic";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "academic.certificates",
    rateLimit: "sensitive",
    input: updateCertificateSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Certificate id is required");
    }
    return updateCertificate(actor!, params.id, input, ip);
  },
);
