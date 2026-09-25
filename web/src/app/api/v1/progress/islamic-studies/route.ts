import { apiRoute } from "@/server/api/handler";
import {
  getIslamicStudiesProgressDesk,
  saveIslamicStudiesProgress,
} from "@/server/lms/islamic-progress";
import {
  listIslamicProgressSchema,
  saveIslamicStudiesProgressSchema,
} from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listIslamicProgressSchema,
  },
  async ({ actor, input }) =>
    getIslamicStudiesProgressDesk(actor!, {
      studentUserId: input.studentUserId,
    }),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: saveIslamicStudiesProgressSchema,
  },
  async ({ actor, input, ip }) => saveIslamicStudiesProgress(actor!, input, ip),
);
