import { z } from "zod";
import { AI_LOCALES, AI_SPEAKER_ROLES } from "@/lib/ai-systems";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && !value.trim() ? undefined : value;

export const listAiDeskSchema = z.object({
  studentUserId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  locale: z.preprocess(
    emptyToUndefined,
    z.enum([...AI_LOCALES, "all"]).optional(),
  ),
});

export const saveAiDeskSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("transcribe"),
    classroomId: z.string().uuid(),
    recordingId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
  }),
  z.object({
    action: z.literal("save_text"),
    classroomId: z.string().uuid(),
    recordingId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
    body: z.string().trim().min(2).max(12000),
  }),
  z.object({
    action: z.literal("save_speech"),
    classroomId: z.string().uuid(),
    recordingId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
    finalize: z.boolean().optional(),
    segments: z
      .array(
        z.object({
          body: z.string().trim().min(1).max(800),
          at: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
          startMs: z.number().int().min(0).max(12 * 60 * 60 * 1000).optional(),
          confidence: z.number().min(0).max(1).optional(),
          speakerRole: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
          speakerName: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
          speakerUserId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
        }),
      )
      .min(1)
      .max(80),
  }),
  z.object({
    action: z.literal("review"),
    jobId: z.string().uuid(),
    decision: z.enum(["approve", "reject"]),
    note: z.preprocess(emptyToUndefined, z.string().trim().max(400).optional()),
  }),
  z.object({
    action: z.literal("relabel"),
    jobId: z.string().uuid(),
    segmentIndex: z.number().int().min(0).max(400),
    speakerRole: z.enum(AI_SPEAKER_ROLES),
    speakerName: z.string().trim().min(1).max(80),
  }),
  z.object({
    action: z.literal("summarise"),
    transcriptJobId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("save_summary"),
    classroomId: z.string().uuid(),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
    transcriptJobId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    body: z.string().trim().min(20).max(4000),
    keyPoints: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
    vocabulary: z.preprocess(emptyToUndefined, z.string().trim().max(1200).optional()),
    improvementAreas: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
    nextLessonRecommendations: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(2000).optional(),
    ),
  }),
  z.object({
    action: z.literal("save_key_points"),
    jobId: z.string().uuid(),
    keyPoints: z.string().trim().min(8).max(2000),
  }),
  z.object({
    action: z.literal("save_vocabulary"),
    jobId: z.string().uuid(),
    vocabulary: z.string().trim().min(2).max(1200),
  }),
  z.object({
    action: z.literal("save_improvement_areas"),
    jobId: z.string().uuid(),
    improvementAreas: z.string().trim().min(8).max(2000),
  }),
  z.object({
    action: z.literal("save_next_recommendations"),
    jobId: z.string().uuid(),
    nextLessonRecommendations: z.string().trim().min(8).max(2000),
  }),
  z.object({
    action: z.literal("save_notes"),
    transcriptJobId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("save_typed_notes"),
    classroomId: z.string().uuid(),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
    transcriptJobId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    body: z.string().trim().min(8).max(4000),
  }),
  z.object({
    action: z.literal("update_notes"),
    jobId: z.string().uuid(),
    body: z.string().trim().min(8).max(4000),
  }),
  z.object({
    action: z.literal("generate_homework"),
    transcriptJobId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("save_typed_homework"),
    classroomId: z.string().uuid(),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
    transcriptJobId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(20).max(4000),
    tasks: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  }),
  z.object({
    action: z.literal("update_homework"),
    jobId: z.string().uuid(),
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(20).max(4000),
    tasks: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  }),
  z.object({
    action: z.literal("generate_quiz_lesson"),
    transcriptJobId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("generate_quiz_book"),
    materialId: z.string().uuid(),
    classroomId: z.string().uuid(),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
  }),
  z.object({
    action: z.literal("generate_quiz_topic"),
    topic: z.string().trim().min(1).max(80),
    classroomId: z.string().uuid(),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
  }),
  z.object({
    action: z.literal("generate_quiz_upload"),
    fileId: z.string().uuid(),
    classroomId: z.string().uuid(),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
  }),
  z.object({
    action: z.literal("generate_quiz_previous"),
    previousClassroomId: z.string().uuid(),
    classroomId: z.string().uuid(),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
  }),
  z.object({
    action: z.literal("save_typed_quiz"),
    classroomId: z.string().uuid(),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(20).max(4000),
    questions: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  }),
  z.object({
    action: z.literal("update_quiz"),
    jobId: z.string().uuid(),
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(20).max(4000),
    questions: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  }),
  z.object({
    action: z.literal("generate_recommendation"),
    transcriptJobId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("generate_recommendation_previous"),
    previousClassroomId: z.string().uuid(),
    classroomId: z.string().uuid(),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
  }),
  z.object({
    action: z.literal("save_typed_recommendation"),
    classroomId: z.string().uuid(),
    locale: z.preprocess(emptyToUndefined, z.enum(AI_LOCALES).optional()),
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(20).max(4000),
    items: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  }),
  z.object({
    action: z.literal("update_recommendation"),
    jobId: z.string().uuid(),
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(20).max(4000),
    items: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  }),
]);
