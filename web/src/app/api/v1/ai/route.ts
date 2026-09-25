import { apiRoute } from "@/server/api/handler";
import { getAiSystemsDesk, saveAiSystemsDesk } from "@/server/ai/service";
import { listAiDeskSchema, saveAiDeskSchema } from "@/server/ai/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listAiDeskSchema,
  },
  async ({ actor, input }) =>
    getAiSystemsDesk(actor!, {
      studentUserId: input.studentUserId,
      q: input.q,
      locale: input.locale,
    }),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: saveAiDeskSchema,
  },
  async ({ actor, input, ip }) => saveAiSystemsDesk(actor!, input, ip),
);
