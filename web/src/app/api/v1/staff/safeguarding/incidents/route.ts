import { hasAnyPermission } from "@/lib/rbac";
import { apiRoute } from "@/server/api/handler";
import { createIncidentSchema } from "@/server/staff/schemas";
import {
  createIncident,
  listSafeguardingWorkspace,
} from "@/server/staff/safeguarding";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["safeguarding.incidents", "safeguarding.recordings"],
    rateLimit: "sensitive",
  },
  async ({ actor }) => {
    const data = await listSafeguardingWorkspace();
    if (!hasAnyPermission(actor!, "audit.read")) {
      return { ...data, recentAudit: [] };
    }
    return data;
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    permission: "safeguarding.incidents",
    rateLimit: "sensitive",
    input: createIncidentSchema,
  },
  async ({ actor, input, ip }) => createIncident(actor!, input, ip),
);
