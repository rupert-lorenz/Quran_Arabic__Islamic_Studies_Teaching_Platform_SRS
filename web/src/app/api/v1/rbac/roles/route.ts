import { apiRoute } from "@/server/api/handler";
import { listRolesWithPermissions } from "@/server/rbac/permissions";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", permission: "rbac.read", rateLimit: "sensitive" },
  async () => listRolesWithPermissions(),
);
