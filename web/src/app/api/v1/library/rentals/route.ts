import { apiRoute } from "@/server/api/handler";
import {
  assignLibraryRental,
  endLibraryRental,
  extendLibraryRental,
  listLibraryRentalDesk,
  setMaterialRentalDays,
} from "@/server/lms/rentals";
import { libraryRentalActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listLibraryRentalDesk(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: libraryRentalActionSchema,
  },
  async ({ actor, input, ip }) => {
    if (input.action === "set_days") {
      return setMaterialRentalDays(actor!, input, ip);
    }
    if (input.action === "assign") {
      return assignLibraryRental(actor!, input, ip);
    }
    if (input.action === "extend") {
      return extendLibraryRental(actor!, input, ip);
    }
    return endLibraryRental(actor!, input, ip);
  },
);
