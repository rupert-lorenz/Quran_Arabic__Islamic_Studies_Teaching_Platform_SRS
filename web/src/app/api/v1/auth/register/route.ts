import { apiRoute } from "@/server/api/handler";
import { registerAccount } from "@/server/auth/register";
import { registerSchema } from "@/server/auth/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "public", csrf: true, rateLimit: "sensitive", input: registerSchema },
  async ({ input, ip }) => registerAccount({ ...input, ip }),
);
