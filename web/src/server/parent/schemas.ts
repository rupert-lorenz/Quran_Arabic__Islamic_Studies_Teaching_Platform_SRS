import { z } from "zod";
import {
  canBeParentManagedChild,
  canRegisterParent,
  normalizeParentPhone,
  parentManagedChildAgeMessage,
} from "@/lib/parent-profile";
import { parseDateOfBirth } from "@/lib/student-profile";
import { studentLevelSchema } from "@/server/student/schemas";

export const parentRelationshipSchema = z.enum([
  "parent",
  "guardian",
  "other",
]);

export const updateParentProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(160),
    dateOfBirth: z.string().trim().min(10).max(10),
    relationship: parentRelationshipSchema,
    country: z.string().trim().length(2),
    timezone: z.string().trim().min(3).max(64).optional(),
    phone: z.string().trim().max(40).optional(),
    about: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    const dateOfBirth = parseDateOfBirth(value.dateOfBirth);
    if (!dateOfBirth) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Enter a valid date of birth",
      });
    } else if (!canRegisterParent(dateOfBirth)) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message:
          "Parent and guardian accounts are for adults 18 and over. Learners 13+ can create a student account.",
      });
    }

    if (value.phone && !normalizeParentPhone(value.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a valid phone number, or leave it blank",
      });
    }
  });

export type UpdateParentProfileInput = z.infer<typeof updateParentProfileSchema>;

const childProfileFields = {
  displayName: z.string().trim().min(2).max(160),
  dateOfBirth: z.string().trim().min(10).max(10),
  currentLevel: studentLevelSchema.optional(),
  country: z.string().trim().length(2).optional(),
  languages: z.string().trim().max(160).optional(),
  gender: z.string().trim().max(16).optional(),
  about: z.string().trim().max(1000).optional(),
  subjectSlugs: z.array(z.string().trim().min(2).max(40)).max(12).optional(),
};

function refineChildDateOfBirth(
  value: { dateOfBirth: string },
  ctx: z.RefinementCtx,
) {
  const dateOfBirth = parseDateOfBirth(value.dateOfBirth);
  if (!dateOfBirth) {
    ctx.addIssue({
      code: "custom",
      path: ["dateOfBirth"],
      message: "Enter a valid date of birth",
    });
    return;
  }
  if (!canBeParentManagedChild(dateOfBirth)) {
    ctx.addIssue({
      code: "custom",
      path: ["dateOfBirth"],
      message:
        parentManagedChildAgeMessage(dateOfBirth) ??
        "Enter a date of birth for a child aged 3 to 17.",
    });
  }
}

export const addParentChildSchema = z
  .object(childProfileFields)
  .superRefine(refineChildDateOfBirth);

export const updateParentChildSchema = z
  .object({
    ...childProfileFields,
    isPrimary: z.boolean().optional(),
  })
  .superRefine(refineChildDateOfBirth);

export type AddParentChildInput = z.infer<typeof addParentChildSchema>;
export type UpdateParentChildInput = z.infer<typeof updateParentChildSchema>;
