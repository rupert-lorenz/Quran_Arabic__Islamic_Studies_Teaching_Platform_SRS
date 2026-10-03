export * from "./schema/ai";
export * from "./schema/bookings";
export * from "./schema/booking-packages";
export * from "./schema/catalog";
export * from "./schema/classrooms";
export * from "./schema/cms";
export * from "./schema/crm";
export * from "./schema/enums";
export * from "./schema/exams";
export * from "./schema/files";
export * from "./schema/gamification";
export * from "./schema/games";
export * from "./schema/geo";
export * from "./schema/group-class-opportunities";
export * from "./schema/group-lessons";
export * from "./schema/homework";
export * from "./schema/i18n";
export * from "./schema/islamic-progress";
export * from "./schema/identity";
export * from "./schema/lessons";
export * from "./schema/lms";
export * from "./schema/mobile";
export * from "./schema/notifications";
export * from "./schema/live-courses";
export * from "./schema/operations";
export * from "./schema/platform";
export * from "./schema/presence";
export * from "./schema/pricing";
export * from "./schema/privacy";
export * from "./schema/profiles";
export * from "./schema/question-bank";
export * from "./schema/quizzes";
export * from "./schema/reviews";
export * from "./schema/secure-messages";
export * from "./schema/security";

export const platformRoles = [
  {
    key: "super_admin",
    name: "Super Admin",
    description: "Full platform access and permission control",
  },
  {
    key: "admin",
    name: "Admin",
    description: "Operations assigned by Super Admin",
  },
  {
    key: "teacher",
    name: "Teacher",
    description: "Approved teacher account",
  },
  {
    key: "student",
    name: "Student",
    description: "Learner account",
  },
  {
    key: "parent",
    name: "Parent",
    description: "Guardian account linked to children",
  },
  {
    key: "accounts",
    name: "Accounts",
    description: "Payments, payouts, and financial reports",
  },
  {
    key: "marketing",
    name: "Marketing",
    description: "Promotions, campaigns, and referrals",
  },
  {
    key: "academic",
    name: "Academic",
    description: "Curriculum, assessments, and teacher quality",
  },
  {
    key: "safeguarding",
    name: "Safeguarding",
    description: "Restricted safeguarding and incident access",
  },
] as const;
