import { z } from "zod";

export const updateTeacherProfileSchema = z.object({
  headline: z.string().trim().min(4).max(160),
  bio: z.string().trim().min(40).max(2000),
  languages: z.string().trim().min(2).max(160),
  country: z.string().trim().length(2),
  gender: z.string().trim().max(16).optional(),
  audienceSlugs: z.array(z.string().trim().min(2).max(20)).max(4).optional(),
  subjectSlugs: z.array(z.string().min(2).max(40)).min(1).max(12),
});

export const updateTeacherRateSchema = z.object({
  amount: z.string().trim().min(1).max(20),
  currencyCode: z.string().trim().length(3),
});

export const publicTeacherQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  subject: z.string().trim().max(40).optional(),
  language: z.string().trim().max(80).optional(),
  country: z.string().trim().max(2).optional(),
  gender: z.string().trim().max(16).optional(),
  audience: z.string().trim().max(20).optional(),
  minPrice: z.string().trim().max(20).optional(),
  maxPrice: z.string().trim().max(20).optional(),
  minRating: z.string().trim().max(8).optional(),
  video: z.string().trim().max(8).optional(),
  sort: z.string().trim().max(20).optional(),
});

export const teacherDocumentTypeSchema = z.enum([
  "passport",
  "national_id",
  "residence_permit",
  "ijazah",
  "degree",
  "teaching_certificate",
  "other",
]);

export const addTeacherDocumentSchema = z.object({
  purpose: z.enum(["identity", "qualification"]),
  documentType: teacherDocumentTypeSchema,
  originalName: z.string().trim().min(2).max(255),
  mimeType: z.string().trim().min(3).max(120),
  byteSize: z.coerce.number().int().min(1).max(50 * 1024 * 1024),
  externalUrl: z.string().trim().max(500).optional(),
});

export const addTeacherVideoSchema = z.object({
  originalName: z.string().trim().min(2).max(255).optional(),
  mimeType: z.string().trim().max(120).optional(),
  byteSize: z.coerce.number().int().min(0).max(200 * 1024 * 1024).optional(),
  externalUrl: z.string().trim().url().max(500),
});

export const signTeacherAgreementSchema = z.object({
  signatureName: z.string().trim().min(2).max(160),
  accepted: z.literal(true),
});

export const publishTeacherAgreementSchema = z.object({
  version: z.string().trim().min(3).max(40),
  title: z.string().trim().min(4).max(160),
  clauses: z.array(z.string().trim().min(8).max(500)).min(3).max(20),
});

export const reviewTeacherSchema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "interview",
    "return_review",
    "reopen",
    "suspend",
    "restore",
  ]),
  note: z.string().trim().max(500).optional(),
});

export const requestTeacherInterviewSchema = z.object({
  note: z.string().trim().max(500).optional(),
  scheduledAt: z.string().trim().max(80).optional(),
  meetingUrl: z.string().trim().max(500).optional(),
});

export const updateTeacherInterviewSchema = z.object({
  action: z.enum(["schedule", "complete", "no_show", "cancel"]),
  note: z.string().trim().max(500).optional(),
  scheduledAt: z.string().trim().max(80).optional(),
  meetingUrl: z.string().trim().max(500).optional(),
});

export const confirmTeacherInterviewSchema = z.object({
  confirmed: z.literal(true),
});

export const reviewTeacherDocumentSchema = z.object({
  status: z.enum(["verified", "rejected", "more_info", "pending"]),
  note: z.string().trim().max(500).optional(),
});

export type UpdateTeacherProfileInput = z.infer<typeof updateTeacherProfileSchema>;
export type UpdateTeacherRateInput = z.infer<typeof updateTeacherRateSchema>;
export type PublicTeacherQuery = z.infer<typeof publicTeacherQuerySchema>;
export type AddTeacherDocumentInput = z.infer<typeof addTeacherDocumentSchema>;
export type AddTeacherVideoInput = z.infer<typeof addTeacherVideoSchema>;
export type SignTeacherAgreementInput = z.infer<typeof signTeacherAgreementSchema>;
export type PublishTeacherAgreementInput = z.infer<typeof publishTeacherAgreementSchema>;
export type ReviewTeacherInput = z.infer<typeof reviewTeacherSchema>;
export type ReviewTeacherDocumentInput = z.infer<typeof reviewTeacherDocumentSchema>;
export type RequestTeacherInterviewInput = z.infer<typeof requestTeacherInterviewSchema>;
export type UpdateTeacherInterviewInput = z.infer<typeof updateTeacherInterviewSchema>;
export type ConfirmTeacherInterviewInput = z.infer<typeof confirmTeacherInterviewSchema>;
export type TeacherDocumentType = z.infer<typeof teacherDocumentTypeSchema>;
