import { z } from "zod";
import { apiRoute } from "@/server/api/handler";
import { listAccessibleRecordings } from "@/server/classroom/recording-access";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: z.object({
      studentUserId: z.string().uuid().optional(),
    }),
  },
  async ({ actor, input }) =>
    listAccessibleRecordings(actor!, {
      studentUserId: input.studentUserId,
    }),
);
