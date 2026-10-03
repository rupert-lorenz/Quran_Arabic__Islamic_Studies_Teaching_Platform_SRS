import { pgEnum } from "drizzle-orm/pg-core";

export const roleKeyEnum = pgEnum("role_key", [
  "super_admin",
  "admin",
  "teacher",
  "student",
  "parent",
  "accounts",
  "marketing",
  "academic",
  "safeguarding",
]);

export const userStatusEnum = pgEnum("user_status", [
  "pending",
  "active",
  "suspended",
  "rejected",
]);

export const textDirectionEnum = pgEnum("text_direction", ["ltr", "rtl"]);

export const teacherVerificationEnum = pgEnum("teacher_verification_status", [
  "application_started",
  "documents_pending",
  "under_review",
  "interview_required",
  "approved",
  "rejected",
  "suspended",
]);

export const filePurposeEnum = pgEnum("file_purpose", [
  "avatar",
  "qualification",
  "identity",
  "intro_video",
  "teaching_material",
  "recording",
  "homework",
  "student_document",
  "other",
]);

export const homeworkStatusEnum = pgEnum("homework_status", [
  "draft",
  "assigned",
  "closed",
]);

export const homeworkWorkStatusEnum = pgEnum("homework_work_status", [
  "assigned",
  "submitted",
  "marked",
]);

export const homeworkFileKindEnum = pgEnum("homework_file_kind", [
  "brief",
  "submission",
  "feedback",
]);

export const fileVisibilityEnum = pgEnum("file_visibility", [
  "private",
  "restricted",
  "public",
]);

export const documentReviewStatusEnum = pgEnum("document_review_status", [
  "pending",
  "verified",
  "rejected",
  "more_info",
]);

export const teacherInterviewStatusEnum = pgEnum("teacher_interview_status", [
  "requested",
  "scheduled",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
]);

export const teacherApplicationEventKindEnum = pgEnum(
  "teacher_application_event_kind",
  [
    "submitted",
    "status_changed",
    "interview_requested",
    "interview_scheduled",
    "interview_confirmed",
    "interview_completed",
    "interview_no_show",
    "interview_cancelled",
    "note_added",
    "agreement_signed",
  ],
);

export const teacherDocumentTypeEnum = pgEnum("teacher_document_type", [
  "passport",
  "national_id",
  "residence_permit",
  "ijazah",
  "degree",
  "teaching_certificate",
  "other",
]);

export const accountTokenPurposeEnum = pgEnum("account_token_purpose", [
  "email_verify",
  "password_reset",
]);

export const financeOperationKindEnum = pgEnum("finance_operation_kind", [
  "payment",
  "refund",
  "credit",
  "payout",
]);

export const financeOperationStatusEnum = pgEnum("finance_operation_status", [
  "open",
  "in_review",
  "approved",
  "rejected",
  "completed",
  "on_hold",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "active",
  "paused",
  "ended",
]);

export const campaignChannelEnum = pgEnum("campaign_channel", [
  "email",
  "banner",
  "social",
  "referral",
  "other",
]);

export const certificateStatusEnum = pgEnum("certificate_status", [
  "draft",
  "active",
  "retired",
]);

export const incidentSeverityEnum = pgEnum("incident_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "open",
  "investigating",
  "escalated",
  "resolved",
  "closed",
]);

export const teacherReviewStatusEnum = pgEnum("teacher_review_status", [
  "pending",
  "published",
  "hidden",
]);

export const pricingControlScopeEnum = pgEnum("pricing_control_scope", [
  "country",
  "subject",
  "teacher",
]);

export const recordingReviewStatusEnum = pgEnum("recording_review_status", [
  "flagged",
  "under_review",
  "cleared",
  "retained",
]);

export const cmsDocumentTypeEnum = pgEnum("cms_document_type", [
  "page",
  "landing",
  "policy",
  "article",
  "faq",
  "banner",
  "announcement",
]);

export const cmsDocumentStatusEnum = pgEnum("cms_document_status", [
  "draft",
  "published",
  "archived",
]);

export const availabilityKindEnum = pgEnum("availability_kind", [
  "recurring",
  "extra",
  "block",
  "break",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
  "waitlisted",
]);

export const userNotificationKindEnum = pgEnum("user_notification_kind", [
  "group_place_reserved",
  "group_place_available",
  "lesson_reminder",
]);

export const bookingKindEnum = pgEnum("booking_kind", ["trial", "lesson"]);

export const bookingEventKindEnum = pgEnum("booking_event_kind", [
  "created",
  "cancelled",
  "rescheduled",
  "completed",
  "no_show",
]);

export const bookingCancelOutcomeEnum = pgEnum("booking_cancel_outcome", [
  "no_charge",
  "credit_pending",
  "forfeit",
]);

export const classroomStatusEnum = pgEnum("classroom_status", [
  "scheduled",
  "open",
  "live",
  "ended",
]);

export const classroomParticipantRoleEnum = pgEnum(
  "classroom_participant_role",
  ["teacher", "student", "parent", "staff"],
);

export const classroomRecordingStatusEnum = pgEnum(
  "classroom_recording_status",
  ["recording", "ready", "failed"],
);

export const teachingMaterialCategoryEnum = pgEnum(
  "teaching_material_category",
  [
    "quran_book",
    "arabic_book",
    "islamic_studies_book",
    "teacher_guide",
    "worksheet",
    "presentation",
    "video",
    "game",
    "assessment",
    "audio",
  ],
);

export const teachingMaterialStatusEnum = pgEnum("teaching_material_status", [
  "draft",
  "published",
  "archived",
]);

export const teachingMaterialAudienceEnum = pgEnum(
  "teaching_material_audience",
  ["learners", "teachers", "staff"],
);

export const teachingMaterialAccessModeEnum = pgEnum(
  "teaching_material_access_mode",
  ["open", "entitled"],
);

export const teachingMaterialRuleTypeEnum = pgEnum(
  "teaching_material_rule_type",
  [
    "role",
    "live_course",
    "group_lesson",
    "subscription",
    "licence",
    "purchase",
  ],
);

export const teachingMaterialGrantSourceEnum = pgEnum(
  "teaching_material_grant_source",
  ["staff", "purchase", "subscription", "licence"],
);

export const librarySubscriptionStatusEnum = pgEnum(
  "library_subscription_status",
  ["active", "ended"],
);

export const educationalGameKindEnum = pgEnum("educational_game_kind", [
  "match",
  "memory",
  "order",
  "choice",
]);

export const quizQuestionKindEnum = pgEnum("quiz_question_kind", [
  "choice",
  "true_false",
  "short",
  "written",
]);

export const assessmentMarkingStatusEnum = pgEnum("assessment_marking_status", [
  "auto",
  "pending",
  "marked",
]);

export const crmAccountStatusEnum = pgEnum("crm_account_status", [
  "lead",
  "registered",
  "trial_booked",
  "trial_completed",
  "active",
  "inactive",
  "cancelled",
]);

export const supportTicketCategoryEnum = pgEnum("support_ticket_category", [
  "lesson",
  "billing",
  "account",
  "technical",
  "other",
]);

export const supportTicketPriorityEnum = pgEnum("support_ticket_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const supportTicketStatusEnum = pgEnum("support_ticket_status", [
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
]);

export const mobilePlatformEnum = pgEnum("mobile_platform", [
  "ios",
  "android",
  "web",
]);

export const privacyConsentKindEnum = pgEnum("privacy_consent_kind", [
  "privacy",
  "marketing",
]);
