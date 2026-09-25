import { apiRoute } from "@/server/api/handler";
import { createCertificateSchema } from "@/server/staff/schemas";
import { createCertificate } from "@/server/staff/academic";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    permission: "academic.certificates",
    rateLimit: "sensitive",
    input: createCertificateSchema,
  },
  async ({ actor, input, ip }) => createCertificate(actor!, input, ip),
);
