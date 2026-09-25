import { apiRoute } from "@/server/api/handler";
import { getCmsDocument, updateCmsDocument } from "@/server/staff/cms";
import { updateCmsDocumentSchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: "cms.write",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => getCmsDocument(actor!, String(params.id)),
);

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "cms.write",
    rateLimit: "sensitive",
    input: updateCmsDocumentSchema,
  },
  async ({ actor, input, ip, params }) =>
    updateCmsDocument(actor!, String(params.id), input, ip),
);
