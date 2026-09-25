import { apiRoute } from "@/server/api/handler";
import { createGame, listGamesDesk } from "@/server/lms/games";
import { gameCreateSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listGamesDesk(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: gameCreateSchema,
  },
  async ({ actor, input, ip }) => createGame(actor!, input, ip),
);
