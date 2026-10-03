import { apiRoute } from "@/server/api/handler";
import {
  listStudentDocuments,
  storeStudentDocument,
  studentDocumentSchema,
} from "@/server/infrastructure/documents";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => ({ documents: await listStudentDocuments(actor!) }),
);

export const POST = apiRoute(
  {
    auth: "session",
    csrf: true,
    rateLimit: "sensitive",
    maxBody: 2_200_000,
    input: studentDocumentSchema,
  },
  async ({ actor, input, ip }) => storeStudentDocument(actor!, input, ip),
);
