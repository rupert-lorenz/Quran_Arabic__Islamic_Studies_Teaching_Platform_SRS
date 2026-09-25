import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  countries,
  parentProfiles,
  roles,
  studentProfiles,
  teacherProfiles,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/server/api/audit";
import { getRequestLocale } from "@/server/i18n/locale";
import { getRequestMoney } from "@/server/money/currency";
import { ApiError } from "@/server/api/errors";
import { getConfig } from "@/server/config";
import {
  normalizeParentRelationship,
} from "@/lib/parent-profile";
import {
  normalizeStudentLevel,
  parseDateOfBirth,
} from "@/lib/student-profile";
import { sendAccountEmail } from "./mail";
import { hashPassword, normalizeEmail } from "./password";
import { accountActionUrl, issueAccountToken } from "./tokens";

const publicRoles = ["student", "parent", "teacher"] as const;

export async function registerAccount(input: {
  email: string;
  password: string;
  displayName: string;
  roleKey: (typeof publicRoles)[number];
  dateOfBirth?: string;
  country?: string;
  currentLevel?: string;
  relationship?: string;
  ip: string;
}) {
  const email = normalizeEmail(input.email);
  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.key, input.roleKey))
    .limit(1);

  if (!role || !publicRoles.includes(input.roleKey)) {
    throw new ApiError(400, "INVALID_ROLE", "This account type cannot self-register");
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const studentDateOfBirth =
    input.roleKey === "student" ? parseDateOfBirth(input.dateOfBirth) : null;
  const studentLevel =
    input.roleKey === "student"
      ? normalizeStudentLevel(input.currentLevel)
      : null;
  const parentDateOfBirth =
    input.roleKey === "parent" ? parseDateOfBirth(input.dateOfBirth) : null;
  const parentRelationship =
    input.roleKey === "parent"
      ? normalizeParentRelationship(input.relationship)
      : null;
  const countryCode =
    input.roleKey === "student" || input.roleKey === "parent"
      ? input.country?.trim().toUpperCase()
      : "";
  let accountCountry: string | null = null;

  if (countryCode) {
    const [country] = await db
      .select({ iso2: countries.iso2 })
      .from(countries)
      .where(
        and(eq(countries.iso2, countryCode), eq(countries.isEnabled, true)),
      )
      .limit(1);
    if (!country) {
      throw new ApiError(422, "VALIDATION", "Country is not available");
    }
    accountCountry = country.iso2;
  }

  const [preferredLocale, money] = await Promise.all([
    getRequestLocale().catch(() => null),
    getRequestMoney().catch(() => null),
  ]);

  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName: input.displayName.trim(),
        roleId: role.id,
        status: "pending",
        locale: preferredLocale?.code ?? "en",
        currency: money?.currency.code ?? null,
        country: accountCountry,
      })
      .returning();

    if (!created) {
      throw new ApiError(500, "INTERNAL", "Could not create account");
    }

    if (input.roleKey === "teacher") {
      await tx.insert(teacherProfiles).values({ userId: created.id });
    } else if (input.roleKey === "parent") {
      await tx.insert(parentProfiles).values({
        userId: created.id,
        dateOfBirth: parentDateOfBirth,
        relationship: parentRelationship,
      });
    } else {
      await tx.insert(studentProfiles).values({
        userId: created.id,
        dateOfBirth: studentDateOfBirth,
        currentLevel: studentLevel,
      });
    }

    return created;
  });

  const token = await issueAccountToken(user.id, "email_verify");
  const verifyUrl = accountActionUrl("/verify-email", token);

  await sendAccountEmail({
    to: email,
    subject:
      input.roleKey === "teacher"
        ? "Verify your email to continue your teacher application"
        : input.roleKey === "student"
          ? "Verify your email to start your student profile"
          : input.roleKey === "parent"
            ? "Verify your email to start your family account"
            : "Verify your email",
    text:
      input.roleKey === "teacher"
        ? `Confirm your email to continue teacher onboarding: ${verifyUrl}`
        : input.roleKey === "student"
          ? `Confirm your email to start your student profile: ${verifyUrl}`
          : input.roleKey === "parent"
            ? `Confirm your email to start your family account: ${verifyUrl}`
            : `Confirm your email by opening this link: ${verifyUrl}`,
  });

  await writeAuditLog({
    actor: { userId: user.id, roleKey: input.roleKey, permissions: [] },
    action: "account.register",
    entityType: "user",
    entityId: user.id,
    ipAddress: input.ip,
    metadata: { roleKey: input.roleKey },
  });

  return {
    email,
    verifyRequired: true,
    verifyUrl: getConfig().isDevelopment ? verifyUrl : undefined,
  };
}
