import { apiRoute } from "@/server/api/handler";
import {
  listLibraryDownloadDesk,
  setLibraryDownloadRestriction,
} from "@/server/lms/downloads";
import { libraryDownloadActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listLibraryDownloadDesk(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: libraryDownloadActionSchema,
  },
  async ({ actor, input, ip }) =>
    setLibraryDownloadRestriction(actor!, input, ip),
);
