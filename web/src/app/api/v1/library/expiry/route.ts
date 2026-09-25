import { apiRoute } from "@/server/api/handler";
import {
  clearLibraryExpiry,
  listLibraryExpiryDesk,
  setLibraryExpiry,
} from "@/server/lms/expiry";
import { libraryExpiryActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listLibraryExpiryDesk(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: libraryExpiryActionSchema,
  },
  async ({ actor, input, ip }) => {
    if (input.action === "set") {
      return setLibraryExpiry(actor!, input, ip);
    }
    return clearLibraryExpiry(actor!, input, ip);
  },
);
