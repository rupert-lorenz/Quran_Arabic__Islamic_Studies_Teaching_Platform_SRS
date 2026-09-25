import { apiRoute } from "@/server/api/handler";
import {
  getCertificateDesk,
  issueCertificate,
  saveCertificateTemplate,
} from "@/server/lms/certificates";
import {
  certificateActionSchema,
  listCertificatesSchema,
} from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listCertificatesSchema,
  },
  async ({ actor, input }) =>
    getCertificateDesk(actor!, { studentUserId: input.studentUserId }),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: certificateActionSchema,
  },
  async ({ actor, input, ip }) =>
    input.action === "save"
      ? saveCertificateTemplate(actor!, input, ip)
      : issueCertificate(actor!, input, ip),
);
