import { apiRoute } from "@/server/api/handler";
import { createCmsDocument, listCmsWorkspace } from "@/server/staff/cms";
import { createCmsDocumentSchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: "cms.write",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listCmsWorkspace(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    permission: "cms.write",
    rateLimit: "sensitive",
    input: createCmsDocumentSchema,
  },
  async ({ actor, input, ip }) => createCmsDocument(actor!, input, ip),
);
