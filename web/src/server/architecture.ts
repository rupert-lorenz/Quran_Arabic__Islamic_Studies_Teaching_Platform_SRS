export const environments = ["development", "staging", "production"] as const;

export const dataStores = [
  {
    key: "postgres",
    role: "system of record",
    owns: [
      "identity",
      "geo",
      "profiles",
      "catalog",
      "cms",
      "files metadata",
      "i18n",
      "platform settings",
      "audit logs",
    ],
  },
  {
    key: "redis",
    role: "ephemeral cache and locks",
    owns: ["live session cache", "booking locks", "rate limits", "job queues"],
  },
  {
    key: "object_storage",
    role: "binary assets",
    owns: ["avatars", "documents", "intro videos", "recordings"],
    note: "Postgres stores storage_key only. Files are never written to local disk.",
  },
] as const;

export const platformModules = [
  {
    key: "identity",
    tables: ["users", "roles", "permissions", "role_permissions", "sessions"],
  },
  {
    key: "geo",
    tables: ["countries", "currencies", "fx_rates", "locales"],
  },
  {
    key: "i18n",
    tables: ["translations"],
  },
  {
    key: "profiles",
    tables: [
      "teacher_profiles",
      "student_profiles",
      "parent_profiles",
      "parent_children",
      "learning_goals",
      "lesson_history",
      "teacher_subjects",
      "teacher_agreements",
      "teacher_agreement_versions",
      "teacher_document_reviews",
      "teacher_interviews",
      "teacher_application_events",
      "teacher_reviews",
      "pricing_controls",
    ],
  },
  {
    key: "marketplace",
    tables: [
      "teacher_availability",
      "bookings",
      "booking_events",
      "group_class_opportunities",
      "group_class_applications",
    ],
  },
  {
    key: "catalog",
    tables: ["subjects"],
  },
  {
    key: "cms",
    tables: ["cms_documents", "cms_document_locales"],
  },
  {
    key: "files",
    tables: ["files", "file_objects"],
  },
  {
    key: "platform",
    tables: ["platform_settings", "audit_logs"],
  },
  {
    key: "finance",
    tables: ["finance_operations"],
  },
  {
    key: "marketing",
    tables: ["marketing_campaigns"],
  },
  {
    key: "lms",
    tables: [
      "certificates",
      "certificate_awards",
      "gamification_events",
      "presence_events",
      "islamic_progress",
      "islamic_progress_quran_streams",
      "islamic_progress_notes",
      "teaching_materials",
      "teaching_material_access_rules",
      "teaching_material_grants",
      "library_subscription_plans",
      "library_subscription_plan_items",
      "library_subscriptions",
      "library_licence_pools",
      "library_licence_pool_items",
      "library_licence_seats",
      "library_rentals",
      "library_purchases",
      "prerecorded_courses",
      "prerecorded_course_lessons",
      "prerecorded_course_enrollments",
      "educational_games",
      "educational_game_plays",
      "quizzes",
      "quiz_attempts",
      "question_bank_items",
      "exams",
      "exam_sittings",
    ],
  },
  {
    key: "safeguarding",
    tables: [
      "safeguarding_incidents",
      "safeguarding_incident_notes",
      "safeguarding_recording_reviews",
    ],
  },
  {
    key: "classroom",
    tables: [
      "classrooms",
      "classroom_participants",
      "classroom_messages",
      "classroom_files",
      "recordings",
    ],
  },
] as const;

export const reservedModules = [
  {
    key: "lms",
    tables: ["assessments"],
  },
  {
    key: "billing",
    tables: ["payment_intents", "invoices", "payouts", "teacher_wallets"],
  },
] as const;

export const designRules = [
  "UUIDs for all public identifiers",
  "timestamptz everywhere; display in the user timezone",
  "money as integer minor units plus an ISO currency code",
  "soft-delete users with deleted_at; never hard-delete financial or audit history",
  "RBAC is permission keys, not hardcoded role checks in features",
  "Postgres is durable; Redis may be flushed without losing accounts",
  "Public APIs are versioned under /api/v1 and go through apiRoute",
  "Authenticated mutations require a same-origin CSRF check",
  "Inbound webhooks must verify HMAC signatures before any write",
  "Card data and bucket credentials never enter Postgres or the client",
  "Integrations are called only through server adapters, never from the browser",
  "Locale is resolved from cookie, then the signed-in account, then Accept-Language; routes stay unprefixed",
  "Display currency is resolved from cookie, then the signed-in account, then the country default; amounts stay integer minor units plus an ISO code and FX is display-only",
] as const;
