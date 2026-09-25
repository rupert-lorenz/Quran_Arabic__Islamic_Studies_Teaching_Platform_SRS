import { z } from "zod";
import { canSelfRegisterStudent, parseDateOfBirth } from "@/lib/student-profile";

export const studentLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "hifdh",
  "fluent",
]);

export const updateStudentProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(160),
    dateOfBirth: z.string().trim().min(10).max(10),
    currentLevel: studentLevelSchema,
    country: z.string().trim().length(2),
    timezone: z.string().trim().min(3).max(64).optional(),
    languages: z.string().trim().max(160).optional(),
    gender: z.string().trim().max(16).optional(),
    about: z.string().trim().max(1000).optional(),
    subjectSlugs: z.array(z.string().trim().min(2).max(40)).max(12).optional(),
  })
  .superRefine((value, ctx) => {
    const dateOfBirth = parseDateOfBirth(value.dateOfBirth);
    if (!dateOfBirth) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Enter a valid date of birth",
      });
    } else if (!canSelfRegisterStudent(dateOfBirth)) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message:
          "Students under 13 need a parent account. Independent student accounts are for ages 13 and over.",
      });
    }
  });

export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;

export const learningGoalKindSchema = z.enum([
  "fluency",
  "hifdh",
  "tajweed",
  "arabic",
  "islamic_studies",
  "exam",
  "custom",
]);

export const learningGoalStatusSchema = z.enum([
  "active",
  "paused",
  "completed",
]);

export const createLearningGoalSchema = z
  .object({
    kind: learningGoalKindSchema,
    title: z.string().trim().max(160).optional(),
    detail: z.string().trim().max(500).optional(),
    subjectSlug: z.string().trim().max(40).optional(),
    targetDate: z.string().trim().max(10).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "custom" && (value.title?.trim().length ?? 0) < 4) {
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "Describe this custom goal in a few words",
      });
    }
    if (value.targetDate?.trim() && !parseDateOfBirth(value.targetDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["targetDate"],
        message: "Enter a valid target date",
      });
    }
  });

export const updateLearningGoalSchema = z
  .object({
    kind: learningGoalKindSchema.optional(),
    title: z.string().trim().max(160).optional(),
    detail: z.string().trim().max(500).optional(),
    subjectSlug: z.string().trim().max(40).optional(),
    targetDate: z.string().trim().max(10).optional(),
    status: learningGoalStatusSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "custom" && value.title !== undefined && value.title.trim().length < 4) {
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "Describe this custom goal in a few words",
      });
    }
    if (value.targetDate?.trim() && !parseDateOfBirth(value.targetDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["targetDate"],
        message: "Enter a valid target date",
      });
    }
  });

export type CreateLearningGoalInput = z.infer<typeof createLearningGoalSchema>;
export type UpdateLearningGoalInput = z.infer<typeof updateLearningGoalSchema>;

export const lessonHistoryStatusSchema = z.enum([
  "completed",
  "cancelled",
  "no_show",
]);

export const listLessonHistorySchema = z.object({
  studentEmail: z.email().optional(),
  studentUserId: z.string().uuid().optional(),
});

export const recordLessonSchema = z
  .object({
    studentEmail: z.email().optional(),
    studentUserId: z.string().uuid().optional(),
    teacherEmail: z.email().optional(),
    teacherUserId: z.string().uuid().optional(),
    subjectSlug: z.string().trim().max(40).optional(),
    title: z.string().trim().max(160).optional(),
    status: lessonHistoryStatusSchema,
    startedAt: z.string().trim().min(10).max(40),
    durationMinutes: z.coerce.number().int().min(15).max(180).optional(),
    attendedMinutes: z.coerce.number().int().min(0).max(180).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.studentEmail && !value.studentUserId) {
      ctx.addIssue({
        code: "custom",
        path: ["studentEmail"],
        message: "Enter the student's email",
      });
    }
  });

export type ListLessonHistoryInput = z.infer<typeof listLessonHistorySchema>;
export type RecordLessonInput = z.infer<typeof recordLessonSchema>;
