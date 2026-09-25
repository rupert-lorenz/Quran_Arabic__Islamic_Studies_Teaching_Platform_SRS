import { apiRoute } from "@/server/api/handler";
import { createStaffUserSchema } from "@/server/auth/schemas";
import { createStaffUser, listDirectory } from "@/server/staff/accounts";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", permission: "users.read", rateLimit: "sensitive" },
  async () => ({ users: await listDirectory() }),
);

export const POST = apiRoute(
  {
    auth: "session",
    permission: "users.write",
    rateLimit: "sensitive",
    input: createStaffUserSchema,
  },
  async ({ actor, input, ip }) => createStaffUser(actor!, { ...input, ip }),
);
