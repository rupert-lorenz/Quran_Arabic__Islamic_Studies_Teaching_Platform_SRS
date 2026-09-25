import { z } from "zod";

export const financeKindSchema = z.enum(["payment", "refund", "credit", "payout"]);
export const financeStatusSchema = z.enum([
  "open",
  "in_review",
  "approved",
  "rejected",
  "completed",
  "on_hold",
]);

export const createFinanceOperationSchema = z.object({
  kind: financeKindSchema,
  amount: z.string().trim().min(1).max(20),
  currencyCode: z.string().trim().length(3),
  counterpartyEmail: z.string().trim().max(255).optional(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const updateFinanceOperationSchema = z.object({
  status: financeStatusSchema,
  notes: z.string().trim().max(500).optional(),
});

export const campaignStatusSchema = z.enum([
  "draft",
  "scheduled",
  "active",
  "paused",
  "ended",
]);

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2).max(160),
  channel: z.enum(["email", "banner", "social", "referral", "other"]),
  locale: z.string().trim().max(8).optional().or(z.literal("")),
  summary: z.string().trim().max(400).optional(),
  startsAt: z.string().trim().max(40).optional().or(z.literal("")),
  endsAt: z.string().trim().max(40).optional().or(z.literal("")),
});

export const updateCampaignSchema = z.object({
  status: campaignStatusSchema,
  summary: z.string().trim().max(400).optional(),
});

export const createSubjectSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase slug such as islamic-studies"),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(255).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const updateSubjectSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(255).optional(),
  isEnabled: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const createCertificateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  subjectSlug: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().trim().max(400).optional(),
  heading: z.string().trim().max(160).optional(),
  body: z.string().trim().max(800).optional(),
  signOff: z.string().trim().max(160).optional(),
  awardKind: z.enum(["exam", "quiz", "course", "manual"]).optional(),
  awardSourceId: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().uuid().optional(),
  ),
  passPercent: z.coerce.number().int().min(0).max(100).optional(),
  autoIssue: z.preprocess((value) => {
    if (value === true || value === "true" || value === "on" || value === "1") {
      return true;
    }
    if (value === false || value === "false" || value === "off" || value === "0") {
      return false;
    }
    return undefined;
  }, z.boolean().optional()),
});

export const updateCertificateSchema = z.object({
  status: z.enum(["draft", "active", "retired"]).optional(),
  description: z.string().trim().max(400).optional(),
  heading: z.string().trim().max(160).optional(),
  body: z.string().trim().max(800).optional(),
  signOff: z.string().trim().max(160).optional(),
  awardKind: z.enum(["exam", "quiz", "course", "manual"]).optional(),
  awardSourceId: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().uuid().optional(),
  ),
  passPercent: z.coerce.number().int().min(0).max(100).optional(),
  autoIssue: z.preprocess((value) => {
    if (value === true || value === "true" || value === "on" || value === "1") {
      return true;
    }
    if (value === false || value === "false" || value === "off" || value === "0") {
      return false;
    }
    return undefined;
  }, z.boolean().optional()),
});

export const createIncidentSchema = z.object({
  title: z.string().trim().min(3).max(200),
  severity: z.enum(["low", "medium", "high", "critical"]),
  involvedEmail: z.string().trim().max(255).optional(),
  summary: z.string().trim().min(10).max(800),
});

export const updateIncidentSchema = z.object({
  status: z.enum(["open", "investigating", "escalated", "resolved", "closed"]),
});

export const createIncidentNoteSchema = z.object({
  body: z.string().trim().min(3).max(800),
});

export const createRecordingReviewSchema = z.object({
  reference: z.string().trim().min(2).max(160),
  relatedEmail: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const updateRecordingReviewSchema = z.object({
  status: z.enum(["flagged", "under_review", "cleared", "retained"]),
  notes: z.string().trim().max(500).optional(),
});

export const updateRecordingRetentionSchema = z.object({
  retentionDays: z.number().int().min(1).max(3650),
});

export const updateTeacherRatePolicySchema = z.object({
  minAmount: z.string().trim().min(1).max(20),
  maxAmount: z.string().trim().min(1).max(20),
  commissionPercent: z.coerce.number().min(0).max(80),
  defaultCurrencyCode: z.string().trim().length(3),
  lessonDurationMinutes: z.coerce.number().int().min(15).max(180),
  minNoticeMinutes: z.coerce.number().int().min(0).max(10080).optional(),
  cancelNoticeMinutes: z.coerce.number().int().min(0).max(20160).optional(),
  minCommitmentLessons: z.coerce.number().int().min(1).max(12).optional(),
});

export const upsertPricingControlSchema = z.object({
  scope: z.enum(["country", "subject", "teacher"]),
  scopeKey: z.string().trim().min(2).max(80),
  minAmount: z.string().trim().max(20).optional(),
  maxAmount: z.string().trim().max(20).optional(),
});

export const createCountrySchema = z.object({
  iso2: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "Use a two-letter country code such as KE"),
  iso3: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Za-z]{3}$/, "Use a three-letter country code such as KEN"),
  name: z.string().trim().min(2).max(120),
  defaultTimezone: z.string().trim().min(3).max(64),
  defaultCurrencyCode: z.string().trim().length(3),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const updateCountrySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  defaultTimezone: z.string().trim().min(3).max(64).optional(),
  defaultCurrencyCode: z.string().trim().length(3).optional(),
  isEnabled: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const updateLocaleSchema = z.object({
  isEnabled: z.boolean(),
});

export const upsertTranslationSchema = z.object({
  entityType: z.enum(["ui", "subject"]),
  entityKey: z.string().trim().min(1).max(80),
  locale: z.string().trim().min(2).max(8),
  field: z.string().trim().min(1).max(40),
  value: z.string().trim().min(1).max(2000),
});

export const setPreferredLocaleSchema = z.object({
  locale: z.string().trim().min(2).max(8),
});

export const updateCurrencySchema = z.object({
  isEnabled: z.boolean(),
});

export const upsertFxRateSchema = z.object({
  quoteCode: z.string().trim().length(3),
  rate: z.string().trim().min(1).max(24),
});

export const setPreferredCurrencySchema = z.object({
  currency: z.string().trim().length(3),
});

export const setPreferredTimezoneSchema = z.object({
  timeZone: z.string().trim().min(3).max(64),
  persist: z.boolean().optional(),
});

export const updateSiteSeoSchema = z.object({
  defaultTitle: z.string().trim().max(80),
  defaultDescription: z.string().trim().max(180),
  robotsIndex: z.boolean(),
});

export const updateClassroomOverlaySchema = z.object({
  showMark: z.boolean(),
  showName: z.boolean(),
  showNameAr: z.boolean(),
  showTagline: z.boolean(),
  watermark: z.enum(["bar", "corner", "both"]),
  caption: z.string().trim().max(80),
  primaryColor: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/),
  accentColor: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/),
});

export const cmsTypeSchema = z.enum([
  "page",
  "landing",
  "policy",
  "article",
  "faq",
  "banner",
  "announcement",
]);

export const cmsStatusSchema = z.enum(["draft", "published", "archived"]);

export const cmsSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase slug such as about");

export const createCmsDocumentSchema = z.object({
  type: cmsTypeSchema,
  slug: cmsSlugSchema,
  locale: z.string().trim().min(2).max(8),
  title: z.string().trim().min(2).max(200),
  excerpt: z.string().trim().max(400).optional(),
  body: z.string().trim().max(20000).optional(),
  seoTitle: z.string().trim().max(80).optional(),
  seoDescription: z.string().trim().max(180).optional(),
  ctaLabel: z.string().trim().max(80).optional(),
  ctaHref: z.string().trim().max(200).optional(),
  pinned: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  startsAt: z.string().trim().max(40).optional().or(z.literal("")),
  endsAt: z.string().trim().max(40).optional().or(z.literal("")),
});

export const updateCmsDocumentSchema = z.object({
  type: cmsTypeSchema.optional(),
  slug: cmsSlugSchema.optional(),
  status: cmsStatusSchema.optional(),
  locale: z.string().trim().min(2).max(8).optional(),
  title: z.string().trim().min(2).max(200).optional(),
  excerpt: z.string().trim().max(400).optional(),
  body: z.string().trim().max(20000).optional(),
  seoTitle: z.string().trim().max(80).optional(),
  seoDescription: z.string().trim().max(180).optional(),
  ctaLabel: z.string().trim().max(80).optional(),
  ctaHref: z.string().trim().max(200).optional(),
  pinned: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  startsAt: z.string().trim().max(40).optional().or(z.literal("")),
  endsAt: z.string().trim().max(40).optional().or(z.literal("")),
});

export type CreateFinanceOperationInput = z.infer<typeof createFinanceOperationSchema>;
export type UpdateFinanceOperationInput = z.infer<typeof updateFinanceOperationSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type CreateCertificateInput = z.infer<typeof createCertificateSchema>;
export type UpdateCertificateInput = z.infer<typeof updateCertificateSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type CreateIncidentNoteInput = z.infer<typeof createIncidentNoteSchema>;
export type CreateRecordingReviewInput = z.infer<typeof createRecordingReviewSchema>;
export type UpdateRecordingReviewInput = z.infer<typeof updateRecordingReviewSchema>;
export type UpdateTeacherRatePolicyInput = z.infer<typeof updateTeacherRatePolicySchema>;
export type UpsertPricingControlInput = z.infer<typeof upsertPricingControlSchema>;
export type CreateCountryInput = z.infer<typeof createCountrySchema>;
export type UpdateCountryInput = z.infer<typeof updateCountrySchema>;
export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;
export type UpsertTranslationInput = z.infer<typeof upsertTranslationSchema>;
export type SetPreferredLocaleInput = z.infer<typeof setPreferredLocaleSchema>;
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>;
export type UpsertFxRateInput = z.infer<typeof upsertFxRateSchema>;
export type SetPreferredCurrencyInput = z.infer<typeof setPreferredCurrencySchema>;
export type SetPreferredTimezoneInput = z.infer<typeof setPreferredTimezoneSchema>;
export type CreateCmsDocumentInput = z.infer<typeof createCmsDocumentSchema>;
export type UpdateCmsDocumentInput = z.infer<typeof updateCmsDocumentSchema>;
export type UpdateSiteSeoInput = z.infer<typeof updateSiteSeoSchema>;
export type UpdateClassroomOverlayInput = z.infer<
  typeof updateClassroomOverlaySchema
>;
