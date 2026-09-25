import { z } from "zod";
import { allRoleKeys, staffRoles } from "@/lib/rbac";
import {
  canRegisterParent,
  normalizeParentRelationship,
} from "@/lib/parent-profile";
import {
  canSelfRegisterStudent,
  normalizeStudentLevel,
  parseDateOfBirth,
} from "@/lib/student-profile";

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password is too long")
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: "Password must include a letter and a number",
  });

export const registerSchema = z
  .object({
    email: z.email(),
    password: passwordSchema,
    displayName: z.string().trim().min(2).max(160),
    roleKey: z.enum(["student", "parent", "teacher"]),
    dateOfBirth: z.string().trim().max(10).optional(),
    country: z.string().trim().max(2).optional(),
    currentLevel: z.string().trim().max(40).optional(),
    relationship: z.string().trim().max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.roleKey === "student") {
      const dateOfBirth = parseDateOfBirth(value.dateOfBirth);
      if (!dateOfBirth) {
        ctx.addIssue({
          code: "custom",
          path: ["dateOfBirth"],
          message: "Date of birth is required for student accounts",
        });
      } else if (!canSelfRegisterStudent(dateOfBirth)) {
        ctx.addIssue({
          code: "custom",
          path: ["dateOfBirth"],
          message:
            "Students under 13 need a parent account. Independent student accounts are for ages 13 and over.",
        });
      }

      if (value.currentLevel && !normalizeStudentLevel(value.currentLevel)) {
        ctx.addIssue({
          code: "custom",
          path: ["currentLevel"],
          message: "Choose a valid current level",
        });
      }
      return;
    }

    if (value.roleKey !== "parent") {
      return;
    }

    const dateOfBirth = parseDateOfBirth(value.dateOfBirth);
    if (!dateOfBirth) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Date of birth is required for parent and guardian accounts",
      });
    } else if (!canRegisterParent(dateOfBirth)) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message:
          "Parent and guardian accounts are for adults 18 and over. Learners 13+ can create a student account.",
      });
    }

    if (value.relationship && !normalizeParentRelationship(value.relationship)) {
      ctx.addIssue({
        code: "custom",
        path: ["relationship"],
        message: "Choose a valid relationship",
      });
    }
  });

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export const emailSchema = z.object({
  email: z.email(),
});

export const tokenSchema = z.object({
  token: z.string().min(10).max(200),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const updateAccountSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
});

export const twoFactorCodeSchema = z.object({
  code: z.string().trim().min(6).max(20),
});

export const bootstrapSuperAdminSchema = z.object({
  email: z.email(),
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(160),
});

export const createStaffUserSchema = z.object({
  email: z.email(),
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(160),
  roleKey: z.enum(staffRoles),
});

export const updateUserPermissionsSchema = z.object({
  mode: z.enum(["role", "custom"]),
  keys: z.array(z.string().min(1).max(80)).max(200),
});

export const updateStaffUserSchema = z
  .object({
    displayName: z.string().trim().min(2).max(160).optional(),
    roleKey: z.enum(allRoleKeys).optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .refine(
    (value) =>
      value.displayName !== undefined ||
      value.roleKey !== undefined ||
      value.status !== undefined,
    { message: "Provide a field to update" },
  );
