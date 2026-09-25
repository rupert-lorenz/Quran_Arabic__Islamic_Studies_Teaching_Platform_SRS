import { z } from "zod";

export const submitTeacherReviewSchema = z.object({
  teacherUserId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(20).max(2000),
  recommend: z.boolean(),
});

export const moderateTeacherReviewSchema = z.object({
  status: z.enum(["published", "hidden", "pending"]),
  note: z.string().trim().max(500).optional(),
});

export const updateTeacherStatsSchema = z.object({
  responseRate: z.coerce.number().int().min(0).max(100).optional(),
  lessonsTaught: z.coerce.number().int().min(0).max(100000).optional(),
});

export const ownTeacherReviewQuerySchema = z.object({
  teacherUserId: z.string().uuid(),
});

export const staffReviewsQuerySchema = z.object({
  status: z.enum(["pending", "published", "hidden", "all"]).optional(),
});

export type SubmitTeacherReviewInput = z.infer<typeof submitTeacherReviewSchema>;
export type ModerateTeacherReviewInput = z.infer<typeof moderateTeacherReviewSchema>;
export type UpdateTeacherStatsInput = z.infer<typeof updateTeacherStatsSchema>;
