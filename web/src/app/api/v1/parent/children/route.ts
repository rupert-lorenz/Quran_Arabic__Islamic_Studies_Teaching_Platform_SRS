import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  addParentChild,
  listParentChildren,
} from "@/server/parent/children";
import { addParentChildSchema } from "@/server/parent/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(403, "FORBIDDEN", "Only parents can view children");
    }
    return { children: await listParentChildren(actor!.userId) };
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: addParentChildSchema,
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(403, "FORBIDDEN", "Only parents can add children");
    }
    return addParentChild(actor!, input, ip);
  },
);
