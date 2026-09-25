import { apiRoute } from "@/server/api/handler";
import { createSubjectSchema } from "@/server/staff/schemas";
import { createSubject, listAcademicWorkspace } from "@/server/staff/academic";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["academic.curriculum", "academic.certificates"],
    rateLimit: "sensitive",
  },
  async () => listAcademicWorkspace(),
);

export const POST = apiRoute(
  {
    auth: "session",
    permission: "academic.curriculum",
    rateLimit: "sensitive",
    input: createSubjectSchema,
  },
  async ({ actor, input, ip }) => createSubject(actor!, input, ip),
);
