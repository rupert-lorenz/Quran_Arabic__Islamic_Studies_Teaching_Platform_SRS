import { apiRoute } from "@/server/api/handler";
import { getMobileFaculties } from "@/server/mobile/faculties";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => getMobileFaculties(actor!),
);
