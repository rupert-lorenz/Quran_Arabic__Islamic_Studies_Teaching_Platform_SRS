import { count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  cmsDocuments,
  countries,
  currencies,
  locales,
  financeOperations,
  lessonHistory,
  marketingCampaigns,
  parentChildren,
  roles,
  safeguardingIncidents,
  teacherProfiles,
  teacherReviews,
  users,
} from "@/db/schema";
import type { DashboardAction, DashboardStat } from "@/lib/dashboard";
import { hasAnyPermission } from "@/lib/rbac";
import {
  applicationStatusLabel,
  teacherStatusMessage,
  teacherStatusNextStep,
} from "@/lib/teacher-status";
import { getManagedParentProfile } from "@/server/parent/profile";
import { listLearningGoals } from "@/server/student/goals";
import {
  getLessonHistoryState,
  getTeacherLessonHistoryState,
} from "@/server/student/lessons";
import { getManagedStudentProfile } from "@/server/student/profile";
import { getManagedTeacherProfile } from "@/server/teacher/profile";
import { getTeacherVerificationSummary } from "@/server/teacher/onboarding";
import { listUpcomingLessons } from "@/server/booking/service";

type CountRow = { key: string; value: number };
type TotalRow = { value: number };

function countBy(rows: CountRow[], key: string) {
  return Number(rows.find((row) => row.key === key)?.value ?? 0);
}

function totalOf(rows: TotalRow[]) {
  return Number(rows[0]?.value ?? 0);
}

export async function getStudentDashboard(userId: string) {
  const actor = { userId, roleKey: "student", permissions: [] };
  const [profile, goals, history, upcoming] = await Promise.all([
    getManagedStudentProfile(userId),
    listLearningGoals(userId),
    getLessonHistoryState(userId),
    listUpcomingLessons(actor, 1),
  ]);
  const activeGoals = goals.filter((goal) => goal.status === "active").length;
  const actions: DashboardAction[] = [];
  if (!profile.completeness.ready) {
    actions.push({
      href: "/learn/profile",
      label: "Finish your student profile",
      detail: profile.completeness.missing.join(", "),
    });
  }
  if (!goals.length) {
    actions.push({
      href: "/learn/goals",
      label: "Add a learning goal",
      detail: "Tell teachers what you want to work toward.",
    });
  }
  actions.push({
    href: "/teachers",
    label: "Find a teacher",
    detail: "Browse teachers and book a one-to-one lesson.",
  });
  if (profile.completeness.ready) {
    actions.push({
      href: "/learn/bookings",
      label: "Your bookings",
      detail: "See confirmed lessons, cancel, or reschedule.",
    });
  }
  actions.push({
    href: "/learn/library",
    label: "Teaching library",
    detail: "Qur'an, Arabic, and Islamic Studies books, worksheets, and videos.",
  });
  actions.push({
    href: "/learn/homework",
    label: "Homework",
    detail: "Open assigned work, attach files, and read teacher feedback.",
  });
  actions.push({
    href: "/learn/games",
    label: "Interactive games",
    detail: "Play match, memory, order, and choice practice games.",
  });
  actions.push({
    href: "/learn/quizzes",
    label: "Quizzes",
      detail: "Sit scored quizzes. Some show questions in a new order each time.",
  });
  actions.push({
    href: "/learn/exams",
    label: "Exams",
    detail: "Sit a timed exam in one sitting while the window is open.",
  });
  actions.push({
    href: "/learn/reports",
    label: "Your report",
    detail: "See quiz, exam, homework, game, course, and lesson results.",
  });
  actions.push({
    href: "/learn/certificates",
    label: "Certificates",
    detail: "Open certificates issued after a quiz, exam, course, or teacher award.",
  });
  actions.push({
    href: "/learn/rewards",
    label: "Rewards",
    detail: "See points, badges, and your daily streak.",
  });
  actions.push({
    href: "/learn/attendance",
    label: "Attendance",
    detail: "See present and missed lessons, plus scheduled and classroom minutes.",
  });
  actions.push({
    href: "/learn/activity",
    label: "Login and lesson times",
    detail: "See when you signed in or out, and when you entered or left a lesson.",
  });
  actions.push({
    href: "/learn/progress",
    label: "Islamic education progress",
    detail: "See your Qur'an position, Arabic skills, and Islamic Studies course.",
  });
  actions.push({
    href: "/learn/quran",
    label: "Qur'an and Hifdh progress",
    detail: "See your current surah, juz', page, and ayah, plus memorisation and revision.",
  });
  actions.push({
    href: "/learn/arabic",
    label: "Arabic language progress",
    detail: "See your reading, writing, speaking, listening, vocabulary, and grammar, plus book and lesson.",
  });
  actions.push({
    href: "/learn/islamic-studies",
    label: "Islamic Studies progress",
    detail: "See your course, level, unit, lesson, homework, assessment, and completion.",
  });
  actions.push({
    href: "/learn/ai",
    label: "AI Systems",
    detail: "Search and read published lesson transcripts, summaries, homework drafts, quiz drafts, and learning recommendations after a teacher has approved them. AI-generated text is labelled, and safety controls stay on. Official marks, certificates, and safeguarding stay with a teacher or staff member. Jot private notes in the lesson or from a transcript.",
  });

  return {
    profile,
    goals,
    history,
    nextLesson: upcoming[0] ?? null,
    stats: [
      {
        label: "Profile",
        value: profile.completeness.ready ? "Ready" : "To finish",
      },
      { label: "Active goals", value: activeGoals },
      { label: "Completed lessons", value: history.summary.completed },
      { label: "Subjects", value: profile.profile.subjectSlugs.length },
    ] satisfies DashboardStat[],
    actions,
  };
}

export async function getParentDashboard(userId: string) {
  const actor = { userId, roleKey: "parent", permissions: [] };
  const [profile, upcoming] = await Promise.all([
    getManagedParentProfile(userId),
    listUpcomingLessons(actor, 1),
  ]);
  const children = profile.children;
  const activeGoals = children.reduce(
    (sum, child) => sum + (child.activeGoalCount ?? 0),
    0,
  );
  const completedLessons = children.reduce(
    (sum, child) => sum + (child.completedLessonCount ?? 0),
    0,
  );
  const actions: DashboardAction[] = [];
  if (!profile.completeness.ready) {
    actions.push({
      href: "/family/profile",
      label: "Finish your family profile",
      detail: profile.completeness.missing.join(", "),
    });
  }
  if (!children.length) {
    actions.push({
      href: "/family/children/new",
      label: "Add a child",
      detail: "Each child keeps their own learning profile.",
    });
  } else {
    const child = children.find((item) => !item.activeGoalCount);
    if (child) {
      actions.push({
        href: `/family/children/${child.userId}/goals`,
        label: `Add a goal for ${child.displayName}`,
        detail: "Teachers use goals when planning lessons.",
      });
    }
  }
  actions.push({
    href: "/teachers",
    label: "Find a teacher",
    detail: "Browse verified teachers and book a lesson for a child.",
  });
  if (children.length) {
    actions.push({
      href: "/family/bookings",
      label: "Your bookings",
      detail: "See confirmed lessons, cancel, or reschedule.",
    });
  }
  actions.push({
    href: "/family/library",
    label: "Teaching library",
    detail: "Books, worksheets, and videos families can open with the child.",
  });
  actions.push({
    href: "/family/homework",
    label: "Homework",
    detail: "See deadlines, submissions, marks, and teacher feedback.",
  });
  actions.push({
    href: "/family/games",
    label: "Interactive games",
    detail: "Play published practice games and see the child's latest score.",
  });
  actions.push({
    href: "/family/quizzes",
    label: "Quizzes",
    detail: "Sit published quizzes and see the child's latest score.",
  });
  actions.push({
    href: "/family/exams",
    label: "Exams",
    detail: "Sit a timed exam for a child while the window is open.",
  });
  actions.push({
    href: "/family/reports",
    label: "Student reports",
    detail: "See each child's quiz, exam, homework, and lesson results.",
  });
  actions.push({
    href: "/family/certificates",
    label: "Certificates",
    detail: "See each child's issued certificates.",
  });
  actions.push({
    href: "/family/rewards",
    label: "Rewards",
    detail: "See each child's points, badges, and streak.",
  });
  actions.push({
    href: "/family/attendance",
    label: "Attendance",
    detail: "See each child's attendance rate and lesson duration.",
  });
  actions.push({
    href: "/family/activity",
    label: "Login and lesson times",
    detail: "See your sign-ins and each child's classroom entry and exit.",
  });
  actions.push({
    href: "/family/progress",
    label: "Islamic education progress",
    detail: "See each child's Qur'an, Arabic, and Islamic Studies progress.",
  });
  actions.push({
    href: "/family/quran",
    label: "Qur'an and Hifdh progress",
    detail: "See each child's current Qur'an position, weekly target, and teacher comments.",
  });
  actions.push({
    href: "/family/arabic",
    label: "Arabic language progress",
    detail: "See each child's Arabic skills, book, level, unit, lesson, and pages.",
  });
  actions.push({
    href: "/family/islamic-studies",
    label: "Islamic Studies progress",
    detail: "See each child's Islamic Studies course, lesson, homework, assessment, and completion.",
  });
  actions.push({
    href: "/family/ai",
    label: "AI Systems",
    detail: "Search and read each child's published lesson transcripts, summaries, homework drafts, quiz drafts, and learning recommendations after a teacher has approved them. AI-generated text is labelled, and safety controls stay on. Official marks, certificates, and safeguarding stay with a teacher or staff member. Private student notes stay with the learner.",
  });

  return {
    profile,
    children,
    nextLesson: upcoming[0] ?? null,
    stats: [
      {
        label: "Profile",
        value: profile.completeness.ready ? "Ready" : "To finish",
      },
      { label: "Children", value: children.length },
      { label: "Active goals", value: activeGoals },
      { label: "Completed lessons", value: completedLessons },
    ] satisfies DashboardStat[],
    actions,
  };
}

export async function getTeacherDashboard(userId: string) {
  const summary = await getTeacherVerificationSummary(userId);
  const approved = summary.verificationStatus === "approved";
  const [profile, history, upcoming] = await Promise.all([
    approved ? getManagedTeacherProfile(userId) : Promise.resolve(null),
    getTeacherLessonHistoryState(userId),
    approved
      ? listUpcomingLessons({ userId, roleKey: "teacher", permissions: [] }, 1)
      : Promise.resolve([]),
  ]);
  const missing: string[] = [];
  if (approved && profile) {
    if (!profile.profile.headline.trim()) missing.push("Headline");
    if (!profile.profile.subjectSlugs.length) missing.push("Subjects");
    if (!profile.rate) missing.push("Lesson rate");
  }
  const next = teacherStatusNextStep(
    summary.verificationStatus,
    summary.readyToSubmit,
  );
  const actions: DashboardAction[] = [
    {
      href: next.href,
      label: next.label,
      detail: teacherStatusMessage(summary.verificationStatus, {
        videoAwaitingReview: summary.videoAwaitingReview,
      }),
    },
  ];
  if (approved && missing.length) {
    actions.push({
      href: "/teach/profile",
      label: "Finish your public profile",
      detail: missing.join(", "),
    });
  }
  if (approved) {
    actions.push({
      href: profile?.publicPath ?? "/teachers",
      label: "View your public profile",
      detail: "This is what families see.",
    });
    actions.push({
      href: "/teach/availability",
      label: "Set working hours",
      detail: "Families can only book times you publish.",
    });
    actions.push({
      href: "/teach/bookings",
      label: "Open your calendar",
      detail: "Confirm, reschedule, or complete lessons.",
    });
    actions.push({
      href: "/teach/library",
      label: "Teaching library",
      detail: "Add Qur'an, Arabic, and Islamic Studies materials for lessons.",
    });
    actions.push({
      href: "/teach/homework",
      label: "Homework",
      detail: "Create work, set a deadline, mark submissions, and leave feedback.",
    });
    actions.push({
      href: "/teach/games",
      label: "Interactive games",
      detail: "Build match, memory, order, and choice practice games.",
    });
    actions.push({
      href: "/teach/quizzes",
      label: "Quizzes",
      detail: "Build scored quizzes with a pass mark, attempt limit, and optional random order.",
    });
    actions.push({
      href: "/teach/exams",
      label: "Exams",
      detail: "Schedule a timed one-sitting exam and optionally randomise the questions.",
    });
    actions.push({
      href: "/teach/marking",
      label: "Marking",
      detail: "Auto-marked questions stay scored. Mark written answers and homework.",
    });
    actions.push({
      href: "/teach/reports",
      label: "Student reports",
      detail: "See quiz, exam, homework, and lesson results for your students.",
    });
    actions.push({
      href: "/teach/certificates",
      label: "Certificates",
      detail: "Issue a certificate from an active template to a student you teach.",
    });
    actions.push({
      href: "/teach/rewards",
      label: "Rewards",
      detail: "See points, badges, and streaks for students you teach.",
    });
    actions.push({
      href: "/teach/attendance",
      label: "Attendance",
      detail: "See present and missed lessons and classroom minutes for your students.",
    });
    actions.push({
      href: "/teach/activity",
      label: "Login and lesson times",
      detail: "See sign-ins and classroom entry and exit for students you teach.",
    });
    actions.push({
      href: "/teach/progress",
      label: "Islamic education progress",
      detail: "Record Qur'an, Arabic, and Islamic Studies progress for your students.",
    });
    actions.push({
      href: "/teach/quran",
      label: "Qur'an and Hifdh progress",
      detail: "Record surah, juz', page, ayah, and separate memorisation, revision, Tajweed, and reading.",
    });
    actions.push({
      href: "/teach/arabic",
      label: "Arabic language progress",
      detail: "Record reading, writing, speaking, listening, vocabulary, grammar, and the current book, level, unit, lesson, and pages.",
    });
    actions.push({
      href: "/teach/islamic-studies",
      label: "Islamic Studies progress",
      detail: "Record course, level, unit, lesson, homework, assessment, and completion.",
    });
    actions.push({
      href: "/teach/ai",
      label: "AI Systems",
      detail: "Transcribe lessons, write summaries, homework drafts, quiz drafts, and learning recommendations from lessons, books, topics, uploaded documents, or previous lesson content, keep private notes, search transcripts, label AI-generated work, apply safety controls, and approve academically important AI work before it is published. AI cannot award marks, issue certificates, or decide safeguarding incidents.",
    });
    actions.push({
      href: "/teach/questions",
      label: "Question bank",
      detail: "Store reusable questions and import them into quizzes and exams.",
    });
  } else {
    actions.push({
      href: "/teach/status",
      label: "View verification status",
      detail: "See what staff have checked and what still needs to happen.",
    });
  }

  return {
    summary,
    profile,
    history,
    nextLesson: upcoming[0] ?? null,
    approved,
    missing,
    stats: [
      {
        label: "Status",
        value: applicationStatusLabel(summary.verificationStatus),
      },
      {
        label: "Lessons taught",
        value: summary.stats.lessonsTaught,
      },
      {
        label: "Recorded classes",
        value: history.summary.completed,
      },
      {
        label: "Rating",
        value: summary.stats.ratingLabel,
      },
    ] satisfies DashboardStat[],
    actions,
  };
}

export async function getStaffDashboard(actor: {
  roleKey: string;
  permissions: string[];
}) {
  const can = (keys: string | string[]) => hasAnyPermission(actor, keys);
  const [
    userRows,
    teacherRows,
    pendingReviews,
    openIncidents,
    openFinance,
    liveCampaigns,
    recordedLessons,
    childLinks,
    liveCountries,
    liveCurrencies,
    liveLocales,
    liveCms,
  ] = await Promise.all([
    can("users.read")
      ? db
          .select({ key: roles.key, value: count() })
          .from(users)
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(isNull(users.deletedAt))
          .groupBy(roles.key)
      : Promise.resolve([] as CountRow[]),
    can(["teachers.approve", "teachers.documents.review"])
      ? db
          .select({
            key: teacherProfiles.verificationStatus,
            value: count(),
          })
          .from(teacherProfiles)
          .groupBy(teacherProfiles.verificationStatus)
      : Promise.resolve([] as CountRow[]),
    can(["reviews.moderate", "teachers.approve"])
      ? db
          .select({ value: count() })
          .from(teacherReviews)
          .where(eq(teacherReviews.status, "pending"))
      : Promise.resolve([{ value: 0 }] as TotalRow[]),
    can("safeguarding.incidents")
      ? db
          .select({ value: count() })
          .from(safeguardingIncidents)
          .where(
            inArray(safeguardingIncidents.status, [
              "open",
              "investigating",
              "escalated",
            ]),
          )
      : Promise.resolve([{ value: 0 }] as TotalRow[]),
    can("payments.read")
      ? db
          .select({ value: count() })
          .from(financeOperations)
          .where(
            inArray(financeOperations.status, ["open", "in_review", "on_hold"]),
          )
      : Promise.resolve([{ value: 0 }] as TotalRow[]),
    can("marketing.campaigns")
      ? db
          .select({ value: count() })
          .from(marketingCampaigns)
          .where(
            inArray(marketingCampaigns.status, [
              "draft",
              "scheduled",
              "active",
            ]),
          )
      : Promise.resolve([{ value: 0 }] as TotalRow[]),
    can(["classes.manage", "students.manage"])
      ? db.select({ value: count() }).from(lessonHistory)
      : Promise.resolve([{ value: 0 }] as TotalRow[]),
    can(["students.manage", "parents.manage"])
      ? db.select({ value: count() }).from(parentChildren)
      : Promise.resolve([{ value: 0 }] as TotalRow[]),
    can("settings.write")
      ? db
          .select({ value: count() })
          .from(countries)
          .where(eq(countries.isEnabled, true))
      : Promise.resolve([{ value: 0 }] as TotalRow[]),
    can(["settings.write", "payments.read"])
      ? db
          .select({ value: count() })
          .from(currencies)
          .where(eq(currencies.isEnabled, true))
      : Promise.resolve([{ value: 0 }] as TotalRow[]),
    can(["settings.write", "cms.write"])
      ? db
          .select({ value: count() })
          .from(locales)
          .where(eq(locales.isEnabled, true))
      : Promise.resolve([{ value: 0 }] as TotalRow[]),
    can("cms.write")
      ? db
          .select({ value: count() })
          .from(cmsDocuments)
          .where(eq(cmsDocuments.status, "published"))
      : Promise.resolve([{ value: 0 }] as TotalRow[]),
  ]);

  const stats: DashboardStat[] = [];
  if (can("users.read")) {
    stats.push(
      { label: "Students", value: countBy(userRows, "student") },
      { label: "Parents", value: countBy(userRows, "parent") },
      { label: "Teachers", value: countBy(userRows, "teacher") },
    );
  }
  if (can(["teachers.approve", "teachers.documents.review"])) {
    stats.push(
      {
        label: "In review",
        value: countBy(teacherRows, "under_review"),
      },
      {
        label: "Interviews",
        value: countBy(teacherRows, "interview_required"),
      },
      {
        label: "Approved teachers",
        value: countBy(teacherRows, "approved"),
      },
    );
  }
  if (can(["reviews.moderate", "teachers.approve"])) {
    stats.push({ label: "Pending reviews", value: totalOf(pendingReviews) });
  }
  if (can("safeguarding.incidents")) {
    stats.push({ label: "Open incidents", value: totalOf(openIncidents) });
  }
  if (can("payments.read")) {
    stats.push({ label: "Open finance items", value: totalOf(openFinance) });
  }
  if (can("marketing.campaigns")) {
    stats.push({ label: "Live campaigns", value: totalOf(liveCampaigns) });
  }
  if (can(["classes.manage", "students.manage"])) {
    stats.push({ label: "Recorded lessons", value: totalOf(recordedLessons) });
  }
  if (can(["students.manage", "parents.manage"])) {
    stats.push({ label: "Linked children", value: totalOf(childLinks) });
  }
  if (can("settings.write")) {
    stats.push({ label: "Live countries", value: totalOf(liveCountries) });
  }
  if (can(["settings.write", "payments.read"])) {
    stats.push({ label: "Live currencies", value: totalOf(liveCurrencies) });
  }
  if (can(["settings.write", "cms.write"])) {
    stats.push({ label: "Live locales", value: totalOf(liveLocales) });
  }
  if (can("cms.write")) {
    stats.push({ label: "Published pages", value: totalOf(liveCms) });
  }

  const waitingTeachers =
    countBy(teacherRows, "under_review") +
    countBy(teacherRows, "interview_required") +
    countBy(teacherRows, "documents_pending");
  const actions: DashboardAction[] = [];
  if (
    can(["teachers.approve", "teachers.documents.review"]) &&
    waitingTeachers > 0
  ) {
    actions.push({
      href: "/staff/teachers",
      label: "Review teacher applications",
      detail: "Applications are waiting for a decision.",
    });
  }
  if (can(["reviews.moderate", "teachers.approve"]) && totalOf(pendingReviews) > 0) {
    actions.push({
      href: "/staff/reviews",
      label: "Moderate teacher reviews",
      detail: "New parent reviews are waiting.",
    });
  }
  if (can("safeguarding.incidents") && totalOf(openIncidents) > 0) {
    actions.push({
      href: "/staff/safeguarding",
      label: "Open safeguarding cases",
      detail: "Incidents still need a staff update.",
    });
  }
  if (can(["classes.manage", "teachers.approve"])) {
    actions.push({
      href: "/staff/bookings",
      label: "Open the lesson calendar",
      detail: "Confirmed bookings, cancellations, and reschedules.",
    });
  }
  if (can("classes.manage")) {
    actions.push({
      href: "/staff/group-classes",
      label: "Post a group class",
      detail: "Create an opportunity, choose a teacher, or publish a schedule.",
    });
  }
  if (can(["classes.manage", "students.manage"])) {
    actions.push({
      href: "/staff/lessons",
      label: "Record lesson history",
      detail: "Add completed or missed classes, or complete a booked lesson.",
    });
  }

  return { stats, actions };
}
