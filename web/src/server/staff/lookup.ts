import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { normalizeEmail } from "@/server/auth/password";
import { ApiError } from "@/server/api/errors";

export async function findOptionalUserByEmail(email?: string) {
  if (!email?.trim()) {
    return null;
  }

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
    })
    .from(users)
    .where(and(eq(users.email, normalizeEmail(email)), isNull(users.deletedAt)))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "No account matches that email");
  }

  return row;
}

export async function findUserByEmail(email: string) {
  return findOptionalUserByEmail(email);
}
