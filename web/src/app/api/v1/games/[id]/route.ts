import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getGame, playGame, saveGame, setGameStatus } from "@/server/lms/games";
import { gameActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Game id is required");
    }
    return getGame(actor!, params.id);
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: gameActionSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Game id is required");
    }
    if (input.action === "save") {
      return saveGame(
        actor!,
        {
          gameId: params.id,
          title: input.title,
          instructions: input.instructions,
          subjectSlug: input.subjectSlug,
          payload: input.payload,
        },
        ip,
      );
    }
    if (input.action === "set_status") {
      return setGameStatus(
        actor!,
        { gameId: params.id, status: input.status },
        ip,
      );
    }
    return playGame(
      actor!,
      {
        gameId: params.id,
        pairs: input.pairs,
        order: input.order,
        answers: input.answers,
        studentUserId: input.studentUserId,
      },
      ip,
    );
  },
);
