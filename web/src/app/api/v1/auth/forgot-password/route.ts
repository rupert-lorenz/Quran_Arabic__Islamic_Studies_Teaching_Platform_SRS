import { apiRoute } from "@/server/api/handler";
import { requestPasswordReset } from "@/server/auth/account";
import { emailSchema } from "@/server/auth/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "public", csrf: true, rateLimit: "sensitive", input: emailSchema },
  async ({ input }) => requestPasswordReset(input.email),
);
