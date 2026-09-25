import { apiRoute } from "@/server/api/handler";
import {
  getClassroomBrandWorkspace,
  updateClassroomOverlay,
} from "@/server/classroom/brand";
import { updateClassroomOverlaySchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: "settings.write",
    rateLimit: "sensitive",
  },
  async () => getClassroomBrandWorkspace(),
);

export const PUT = apiRoute(
  {
    auth: "session",
    permission: "settings.write",
    rateLimit: "sensitive",
    input: updateClassroomOverlaySchema,
  },
  async ({ actor, input, ip }) => updateClassroomOverlay(actor!, input, ip),
);
