import { z } from "zod";
import {
  CERTIFICATE_AWARD_KINDS,
  CERTIFICATE_STATUSES,
} from "@/lib/certificates";
import {
  EDUCATIONAL_GAME_KINDS,
  EDUCATIONAL_GAME_STATUSES,
} from "@/lib/games";
import { EXAM_STATUSES } from "@/lib/exams";
import { QUESTION_BANK_STATUSES } from "@/lib/question-bank";
import { QUIZ_QUESTION_KINDS, QUIZ_STATUSES } from "@/lib/quizzes";
import {
  HOMEWORK_FILE_KINDS,
  HOMEWORK_STATUSES,
} from "@/lib/homework";
import {
  ISLAMIC_PROGRESS_TRACKS,
  PROGRESS_ASSESSMENT_STATUSES,
  PROGRESS_HOMEWORK_STATUSES,
  QURAN_MODES,
} from "@/lib/islamic-progress";
import {
  LIBRARY_ACCESS_MODES,
  LIBRARY_EXPIRY_KINDS,
  LIBRARY_GRANT_SOURCES,
  LIBRARY_RULE_TYPES,
  TEACHING_MATERIAL_AUDIENCES,
  TEACHING_MATERIAL_CATEGORIES,
  TEACHING_MATERIAL_STATUSES,
} from "@/lib/library-materials";

export const teachingMaterialCategorySchema = z.enum(
  TEACHING_MATERIAL_CATEGORIES,
);
export const teachingMaterialStatusSchema = z.enum(TEACHING_MATERIAL_STATUSES);
export const teachingMaterialAudienceSchema = z.enum(
  TEACHING_MATERIAL_AUDIENCES,
);
export const libraryAccessModeSchema = z.enum(LIBRARY_ACCESS_MODES);
export const libraryRuleTypeSchema = z.enum(LIBRARY_RULE_TYPES);
export const libraryGrantSourceSchema = z.enum(LIBRARY_GRANT_SOURCES);

export const listTeachingLibrarySchema = z.object({
  category: teachingMaterialCategorySchema.optional(),
  subjectSlug: z.string().trim().max(40).optional(),
});

export const updateTeachingMaterialSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(400).optional(),
  category: teachingMaterialCategorySchema.optional(),
  subjectSlug: z.string().trim().max(40).optional().or(z.literal("")),
  status: teachingMaterialStatusSchema.optional(),
  audience: teachingMaterialAudienceSchema.optional(),
  accessMode: libraryAccessModeSchema.optional(),
  downloadsRestricted: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const libraryFileQuerySchema = z.object({
  download: z.string().trim().max(8).optional(),
});

export const libraryDownloadActionSchema = z.object({
  materialId: z.string().uuid(),
  downloadsRestricted: z.boolean(),
});

export const libraryAccessRuleSchema = z.object({
  ruleType: libraryRuleTypeSchema,
  ruleRef: z.string().trim().max(80).optional().default(""),
});

export const libraryGrantSchema = z.object({
  email: z.email(),
  source: libraryGrantSourceSchema,
  expiresAt: z.string().trim().max(40).optional(),
});

export const libraryCatalogItemSchema = z.object({
  key: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(400).optional(),
});

export const libraryAssignSubscriptionSchema = z.object({
  email: z.email(),
  planKey: z.string().trim().min(2).max(40),
  expiresAt: z.string().trim().max(40).optional(),
});

export const libraryAssignLicenceSchema = z.object({
  email: z.email(),
  poolKey: z.string().trim().min(2).max(40),
  materialId: z.string().uuid().optional(),
  expiresAt: z.string().trim().max(40).optional(),
});

export const libraryEntitlementActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_rule"),
    ruleType: libraryRuleTypeSchema,
    ruleRef: z.string().trim().max(80).optional().default(""),
  }),
  z.object({
    action: z.literal("remove_rule"),
    ruleId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("grant"),
    email: z.email(),
    source: libraryGrantSourceSchema,
    expiresAt: z.string().trim().max(40).optional(),
  }),
  z.object({
    action: z.literal("revoke"),
    grantId: z.string().uuid(),
  }),
]);

export const librarySubscriptionActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_plan"),
    key: z.string().trim().min(2).max(40),
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(400).optional(),
    defaultDays: z.union([z.string(), z.number()]).optional(),
  }),
  z.object({
    action: z.literal("update_plan"),
    key: z.string().trim().min(2).max(40),
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(400).optional(),
    defaultDays: z.union([z.string(), z.number()]).optional(),
    isEnabled: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("attach_material"),
    planKey: z.string().trim().min(2).max(40),
    materialId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("detach_material"),
    planKey: z.string().trim().min(2).max(40),
    materialId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("assign"),
    email: z.email(),
    planKey: z.string().trim().min(2).max(40),
    startsAt: z.string().trim().max(40).optional(),
    expiresAt: z.string().trim().max(40).optional(),
  }),
  z.object({
    action: z.literal("extend"),
    subscriptionId: z.string().uuid(),
    days: z.union([z.string(), z.number()]).optional(),
    expiresAt: z.string().trim().max(40).optional(),
  }),
  z.object({
    action: z.literal("end"),
    subscriptionId: z.string().uuid(),
  }),
]);

export const libraryExpiryActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set"),
    kind: z.enum(LIBRARY_EXPIRY_KINDS),
    id: z.string().uuid(),
    expiresAt: z.string().trim().max(40).optional(),
  }),
  z.object({
    action: z.literal("clear"),
    kind: z.enum(LIBRARY_EXPIRY_KINDS),
    id: z.string().uuid(),
  }),
]);

export const libraryPurchaseActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_purchasable"),
    materialId: z.string().uuid(),
    isPurchasable: z.boolean(),
  }),
  z.object({
    action: z.literal("assign"),
    email: z.email(),
    materialId: z.string().uuid(),
    expiresAt: z.string().trim().max(40).optional(),
  }),
  z.object({
    action: z.literal("revoke"),
    purchaseId: z.string().uuid(),
  }),
]);

export const libraryRentalActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_days"),
    materialId: z.string().uuid(),
    rentalDays: z.union([z.string(), z.number()]).optional(),
  }),
  z.object({
    action: z.literal("assign"),
    email: z.email(),
    materialId: z.string().uuid(),
    days: z.union([z.string(), z.number()]).optional(),
    startsAt: z.string().trim().max(40).optional(),
    expiresAt: z.string().trim().max(40).optional(),
  }),
  z.object({
    action: z.literal("extend"),
    rentalId: z.string().uuid(),
    days: z.union([z.string(), z.number()]).optional(),
    expiresAt: z.string().trim().max(40).optional(),
  }),
  z.object({
    action: z.literal("end"),
    rentalId: z.string().uuid(),
  }),
]);

export const libraryLicenceActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_pool"),
    key: z.string().trim().min(2).max(40),
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(400).optional(),
    seatLimit: z.union([z.string(), z.number()]).optional(),
    defaultDays: z.union([z.string(), z.number()]).optional(),
  }),
  z.object({
    action: z.literal("update_pool"),
    key: z.string().trim().min(2).max(40),
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(400).optional(),
    seatLimit: z.union([z.string(), z.number()]).optional(),
    defaultDays: z.union([z.string(), z.number()]).optional(),
    isEnabled: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("attach_material"),
    poolKey: z.string().trim().min(2).max(40),
    materialId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("detach_material"),
    poolKey: z.string().trim().min(2).max(40),
    materialId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("assign_seat"),
    email: z.email(),
    poolKey: z.string().trim().min(2).max(40),
    materialId: z.string().uuid().optional(),
    expiresAt: z.string().trim().max(40).optional(),
  }),
  z.object({
    action: z.literal("revoke_seat"),
    seatId: z.string().uuid(),
  }),
]);

export const libraryCatalogActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_plan"),
    key: z.string().trim().min(2).max(40),
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(400).optional(),
  }),
  z.object({
    action: z.literal("create_pool"),
    key: z.string().trim().min(2).max(40),
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(400).optional(),
  }),
  z.object({
    action: z.literal("assign_subscription"),
    email: z.email(),
    planKey: z.string().trim().min(2).max(40),
    expiresAt: z.string().trim().max(40).optional(),
  }),
  z.object({
    action: z.literal("assign_licence"),
    email: z.email(),
    poolKey: z.string().trim().min(2).max(40),
    materialId: z.string().uuid().optional(),
    expiresAt: z.string().trim().max(40).optional(),
  }),
]);

export const libraryPrerecordedCourseActionSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("create"),
      title: z.string().trim().min(2).max(160),
      description: z.string().trim().max(400).optional(),
      subjectSlug: z.string().trim().max(40).optional(),
      accessMode: libraryAccessModeSchema.optional(),
    }),
    z.object({
      action: z.literal("set_status"),
      courseId: z.string().uuid(),
      status: teachingMaterialStatusSchema,
    }),
    z.object({
      action: z.literal("add_lesson"),
      courseId: z.string().uuid(),
      materialId: z.string().uuid(),
    }),
    z.object({
      action: z.literal("remove_lesson"),
      lessonId: z.string().uuid(),
    }),
    z.object({
      action: z.literal("enroll"),
      courseId: z.string().uuid(),
      email: z.email(),
      expiresAt: z.string().trim().max(40).optional(),
    }),
    z.object({
      action: z.literal("revoke"),
      enrollmentId: z.string().uuid(),
    }),
  ],
);

export const libraryPrerecordedProgressSchema = z.object({
  action: z.enum(["start", "complete", "reopen"]),
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  studentUserId: z.string().uuid().optional(),
});

export const homeworkCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  instructions: z.string().trim().max(4000).optional(),
  subjectSlug: z.string().trim().max(40).optional(),
  dueAt: z.string().trim().max(40).optional(),
});

export const homeworkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_status"),
    status: z.enum(HOMEWORK_STATUSES),
  }),
  z.object({
    action: z.literal("assign"),
    studentUserId: z.preprocess(
      (value) => (typeof value === "string" && !value.trim() ? undefined : value),
      z.string().uuid().optional(),
    ),
    email: z.preprocess(
      (value) => (typeof value === "string" && !value.trim() ? undefined : value),
      z.email().optional(),
    ),
  }),
  z.object({
    action: z.literal("submit"),
    text: z.string().trim().max(4000).optional(),
  }),
  z.object({
    action: z.literal("mark"),
    studentUserId: z.string().uuid(),
    markLabel: z.string().trim().max(40).optional(),
    feedback: z.string().trim().max(2000).optional(),
  }),
]);

export const homeworkFileKindSchema = z.enum(HOMEWORK_FILE_KINDS);

export const educationalGameKindSchema = z.enum(EDUCATIONAL_GAME_KINDS);

export const gameCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  instructions: z.string().trim().max(400).optional(),
  subjectSlug: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(40).optional(),
  ),
  kind: educationalGameKindSchema,
});

export const gameActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    title: z.string().trim().min(2).max(160).optional(),
    instructions: z.string().trim().max(400).optional(),
    subjectSlug: z.preprocess(
      (value) => (typeof value === "string" && !value.trim() ? undefined : value),
      z.string().trim().max(40).optional(),
    ),
    payload: z.unknown().optional(),
  }),
  z.object({
    action: z.literal("set_status"),
    status: z.enum(EDUCATIONAL_GAME_STATUSES),
  }),
  z.object({
    action: z.literal("play"),
    pairs: z
      .array(
        z.object({
          left: z.string().trim().max(80),
          right: z.string().trim().max(80),
        }),
      )
      .max(12)
      .optional(),
    order: z.array(z.string().trim().max(80)).max(10).optional(),
    answers: z.array(z.number().int().min(0).max(4)).max(10).optional(),
    studentUserId: z.string().uuid().optional(),
  }),
]);

function optionalInt(max: number) {
  return z.preprocess((value) => {
    if (value === "" || value === undefined || value === null) return undefined;
    const next = Number(value);
    return Number.isFinite(next) ? next : value;
  }, z.number().int().min(0).max(max).optional());
}

function optionalBool() {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (value === true || value === "true" || value === "on" || value === "1") {
      return true;
    }
    if (value === false || value === "false" || value === "off" || value === "0") {
      return false;
    }
    return value;
  }, z.boolean().optional());
}

export const quizCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  instructions: z.string().trim().max(400).optional(),
  subjectSlug: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(40).optional(),
  ),
  passPercent: optionalInt(100),
  attemptLimit: optionalInt(10),
  randomiseQuestions: optionalBool(),
});

export const quizActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    title: z.string().trim().min(2).max(160).optional(),
    instructions: z.string().trim().max(400).optional(),
    subjectSlug: z.preprocess(
      (value) => (typeof value === "string" && !value.trim() ? undefined : value),
      z.string().trim().max(40).optional(),
    ),
    passPercent: optionalInt(100),
    attemptLimit: optionalInt(10),
    randomiseQuestions: optionalBool(),
    payload: z.unknown().optional(),
  }),
  z.object({
    action: z.literal("set_status"),
    status: z.enum(QUIZ_STATUSES),
  }),
  z.object({
    action: z.literal("import_bank"),
    questionIds: z.array(z.string().uuid()).min(1).max(20),
  }),
  z.object({
    action: z.literal("save_to_bank"),
    questionId: z.string().trim().min(1).max(64),
    topic: z.string().trim().max(80).optional(),
  }),
  z.object({
    action: z.literal("sit"),
    answers: z
      .array(
        z.object({
          questionId: z.string().trim().min(1).max(64),
          choice: z.number().int().min(0).max(5).optional(),
          trueFalse: z.boolean().optional(),
          text: z.string().trim().max(2000).optional(),
        }),
      )
      .max(20),
    studentUserId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("mark"),
    attemptId: z.string().uuid(),
    marks: z
      .array(
        z.object({
          questionId: z.string().trim().min(1).max(64),
          awarded: z.number().int().min(0).max(1),
          feedback: z.string().trim().max(400).optional(),
        }),
      )
      .min(1)
      .max(20),
  }),
]);

export const listQuestionBankSchema = z.object({
  subjectSlug: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(40).optional(),
  ),
  kind: z.enum(QUIZ_QUESTION_KINDS).optional(),
  topic: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(80).optional(),
  ),
});

export const questionBankCreateSchema = z.object({
  prompt: z.string().trim().min(2).max(400).optional(),
  kind: z.enum(QUIZ_QUESTION_KINDS),
  topic: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(80).optional(),
  ),
  subjectSlug: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(40).optional(),
  ),
  question: z.unknown().optional(),
});

export const questionBankSaveSchema = z.object({
  prompt: z.string().trim().min(2).max(400).optional(),
  kind: z.enum(QUIZ_QUESTION_KINDS).optional(),
  topic: z.string().trim().max(80).optional(),
  subjectSlug: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(40).optional(),
  ),
  status: z.enum(QUESTION_BANK_STATUSES).optional(),
  question: z.unknown().optional(),
});

function optionalDateTime() {
  return z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(40).optional(),
  );
}

export const listStudentReportsSchema = z.object({
  studentUserId: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().uuid().optional(),
  ),
});

export const listCertificatesSchema = z.object({
  studentUserId: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().uuid().optional(),
  ),
});

export const listRewardsSchema = z.object({
  studentUserId: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().uuid().optional(),
  ),
});

export const listAttendanceSchema = z.object({
  studentUserId: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().uuid().optional(),
  ),
});

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && !value.trim() ? undefined : value;

const optionalProgressInt = (min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(min).max(max).optional(),
  );

export const listIslamicProgressSchema = z.object({
  studentUserId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export const saveIslamicProgressSchema = z.object({
  studentUserId: z.string().uuid(),
  track: z.enum(ISLAMIC_PROGRESS_TRACKS),
  surah: optionalProgressInt(1, 114),
  juz: optionalProgressInt(1, 30),
  page: optionalProgressInt(1, 604),
  ayah: optionalProgressInt(1, 286),
  quranMode: z.preprocess(emptyToUndefined, z.enum(QURAN_MODES).optional()),
  reading: optionalProgressInt(0, 100),
  writing: optionalProgressInt(0, 100),
  speaking: optionalProgressInt(0, 100),
  listening: optionalProgressInt(0, 100),
  vocabulary: optionalProgressInt(0, 100),
  grammar: optionalProgressInt(0, 100),
  bookTitle: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  pagesNote: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  courseTitle: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(160).optional(),
  ),
  homeworkStatus: z.preprocess(
    emptyToUndefined,
    z.enum(PROGRESS_HOMEWORK_STATUSES).optional(),
  ),
  assessmentStatus: z.preprocess(
    emptyToUndefined,
    z.enum(PROGRESS_ASSESSMENT_STATUSES).optional(),
  ),
  levelLabel: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  unitLabel: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  lessonLabel: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(160).optional(),
  ),
  weeklyTarget: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(240).optional(),
  ),
  nextLessonTarget: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(240).optional(),
  ),
  completionPercent: optionalProgressInt(0, 100),
  comment: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});

const quranStreamFields = {
  Surah: optionalProgressInt(1, 114),
  Juz: optionalProgressInt(1, 30),
  Page: optionalProgressInt(1, 604),
  Ayah: optionalProgressInt(1, 286),
  Percent: optionalProgressInt(0, 100),
} as const;

export const saveIslamicStudiesProgressSchema = z.object({
  studentUserId: z.string().uuid(),
  courseTitle: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(160).optional(),
  ),
  levelLabel: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  unitLabel: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  lessonLabel: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(160).optional(),
  ),
  homeworkStatus: z.preprocess(
    emptyToUndefined,
    z.enum(PROGRESS_HOMEWORK_STATUSES).optional(),
  ),
  assessmentStatus: z.preprocess(
    emptyToUndefined,
    z.enum(PROGRESS_ASSESSMENT_STATUSES).optional(),
  ),
  completionPercent: optionalProgressInt(0, 100),
  weeklyTarget: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(240).optional(),
  ),
  nextLessonTarget: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(240).optional(),
  ),
  comment: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});

export const saveArabicProgressSchema = z.object({
  studentUserId: z.string().uuid(),
  reading: optionalProgressInt(0, 100),
  writing: optionalProgressInt(0, 100),
  speaking: optionalProgressInt(0, 100),
  listening: optionalProgressInt(0, 100),
  vocabulary: optionalProgressInt(0, 100),
  grammar: optionalProgressInt(0, 100),
  bookTitle: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  pagesNote: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  levelLabel: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  unitLabel: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  lessonLabel: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(160).optional(),
  ),
  weeklyTarget: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(240).optional(),
  ),
  nextLessonTarget: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(240).optional(),
  ),
  comment: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});

export const saveQuranProgressSchema = z.object({
  studentUserId: z.string().uuid(),
  surah: optionalProgressInt(1, 114),
  juz: optionalProgressInt(1, 30),
  page: optionalProgressInt(1, 604),
  ayah: optionalProgressInt(1, 286),
  quranMode: z.preprocess(emptyToUndefined, z.enum(QURAN_MODES).optional()),
  weeklyTarget: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(240).optional(),
  ),
  nextLessonTarget: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(240).optional(),
  ),
  comment: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
  memorisationSurah: quranStreamFields.Surah,
  memorisationJuz: quranStreamFields.Juz,
  memorisationPage: quranStreamFields.Page,
  memorisationAyah: quranStreamFields.Ayah,
  memorisationPercent: quranStreamFields.Percent,
  revisionSurah: quranStreamFields.Surah,
  revisionJuz: quranStreamFields.Juz,
  revisionPage: quranStreamFields.Page,
  revisionAyah: quranStreamFields.Ayah,
  revisionPercent: quranStreamFields.Percent,
  tajweedSurah: quranStreamFields.Surah,
  tajweedJuz: quranStreamFields.Juz,
  tajweedPage: quranStreamFields.Page,
  tajweedAyah: quranStreamFields.Ayah,
  tajweedPercent: quranStreamFields.Percent,
  readingSurah: quranStreamFields.Surah,
  readingJuz: quranStreamFields.Juz,
  readingPage: quranStreamFields.Page,
  readingAyah: quranStreamFields.Ayah,
  readingPercent: quranStreamFields.Percent,
});

export const certificateSaveSchema = z.object({
  action: z.literal("save"),
  id: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().uuid().optional(),
  ),
  name: z.string().trim().min(2).max(160),
  subjectSlug: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(40).optional(),
  ),
  description: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(400).optional(),
  ),
  heading: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(160).optional(),
  ),
  body: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(800).optional(),
  ),
  signOff: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(160).optional(),
  ),
  awardKind: z.enum(CERTIFICATE_AWARD_KINDS).optional(),
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
  status: z.enum(CERTIFICATE_STATUSES).optional(),
});

export const certificateIssueSchema = z.object({
  action: z.literal("issue"),
  certificateId: z.string().uuid(),
  studentUserId: z.string().uuid(),
});

export const certificateActionSchema = z.discriminatedUnion("action", [
  certificateSaveSchema,
  certificateIssueSchema,
]);

export const examCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  instructions: z.string().trim().max(400).optional(),
  subjectSlug: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().max(40).optional(),
  ),
  passPercent: optionalInt(100),
  durationMinutes: optionalInt(180),
  randomiseQuestions: optionalBool(),
  opensAt: optionalDateTime(),
  closesAt: optionalDateTime(),
});

export const examActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    title: z.string().trim().min(2).max(160).optional(),
    instructions: z.string().trim().max(400).optional(),
    subjectSlug: z.preprocess(
      (value) => (typeof value === "string" && !value.trim() ? undefined : value),
      z.string().trim().max(40).optional(),
    ),
    passPercent: optionalInt(100),
    durationMinutes: optionalInt(180),
    randomiseQuestions: optionalBool(),
    opensAt: optionalDateTime(),
    closesAt: optionalDateTime(),
    payload: z.unknown().optional(),
  }),
  z.object({
    action: z.literal("set_status"),
    status: z.enum(EXAM_STATUSES),
  }),
  z.object({
    action: z.literal("import_bank"),
    questionIds: z.array(z.string().uuid()).min(1).max(40),
  }),
  z.object({
    action: z.literal("start"),
    studentUserId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("submit"),
    answers: z
      .array(
        z.object({
          questionId: z.string().trim().min(1).max(64),
          choice: z.number().int().min(0).max(5).optional(),
          trueFalse: z.boolean().optional(),
          text: z.string().trim().max(2000).optional(),
        }),
      )
      .max(40),
    studentUserId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("mark"),
    studentUserId: z.string().uuid(),
    marks: z
      .array(
        z.object({
          questionId: z.string().trim().min(1).max(64),
          awarded: z.number().int().min(0).max(1),
          feedback: z.string().trim().max(400).optional(),
        }),
      )
      .min(1)
      .max(40),
  }),
]);

export type ListTeachingLibraryInput = z.infer<typeof listTeachingLibrarySchema>;
export type UpdateTeachingMaterialInput = z.infer<
  typeof updateTeachingMaterialSchema
>;
