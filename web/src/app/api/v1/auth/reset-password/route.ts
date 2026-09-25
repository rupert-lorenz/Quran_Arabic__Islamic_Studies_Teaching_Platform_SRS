import { apiRoute } from "@/server/api/handler";
import { resetPassword } from "@/server/auth/account";
import { resetPasswordSchema } from "@/server/auth/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "public", csrf: true, rateLimit: "sensitive", input: resetPasswordSchema },
  async ({ input, ip }) => {
    await resetPassword(input.token, input.password, ip);
    return { reset: true };
  },
);
