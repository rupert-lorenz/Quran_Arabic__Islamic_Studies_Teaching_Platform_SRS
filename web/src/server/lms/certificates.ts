import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  certificateAwards,
  certificates,
  examSittings,
  exams,
  lessonHistory,
  parentChildren,
  prerecordedCourseLessons,
  prerecordedCourseProgress,
  prerecordedCourses,
  quizAttempts,
  quizzes,
  studentProfiles,
  subjects,
  users,
} from "@/db/schema";
import {
  CERTIFICATE_DEFAULT_BODY,
  CERTIFICATE_DEFAULT_HEADING,
  CERTIFICATE_DEFAULT_SIGN_OFF,
  certificateAwardHref,
  certificatesHref,
  familyChildCertificatesHref,
  isCertificateAwardKind,
  renderCertificateBody,
  type CertificateAwardKind,
  type CertificateStatus,
} from "@/lib/certificates";
import { libraryCourseProgressPercent } from "@/lib/library-materials";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { requireHumanSensitiveDecision } from "@/server/ai/human-decision";
import { ApiError } from "@/server/api/errors";
import { safeAwardGamification } from "@/server/lms/gamification";
import { assertParentOwnsChild } from "@/server/parent/children";
import { getTeacherVerificationStatus } from "@/server/teacher/onboarding";

export type CertificateSourceOption = {
  id: string;
  title: string;
  kind: CertificateAwardKind;
};

export type CertificateTemplateView = {
  id: string;
  name: string;
  subjectSlug: string | null;
  subjectName: string | null;
  status: CertificateStatus;
  description: string | null;
  heading: string;
  body: string;
  signOff: string;
  awardKind: CertificateAwardKind;
  awardSourceId: string | null;
  sourceTitle: string | null;
  passPercent: number;
  autoIssue: boolean;
};

export type CertificateAwardView = {
  id: string;
  certificateId: string;
  certificateName: string;
  studentUserId: string;
  studentName: string;
  issuedByUserId: string | null;
  sourceKind: CertificateAwardKind;
  sourceId: string | null;
  sourceTitle: string | null;
  heading: string;
  body: string;
  signOff: string;
  issuedAt: string;
  href: string;
};

export type CertificateDesk = {
  href: string;
  canManageTemplates: boolean;
  canIssue: boolean;
  learners: Array<{ studentUserId: string; name: string; href: string }>;
  subjects: Array<{ slug: string; name: string }>;
  sources: CertificateSourceOption[];
  templates: CertificateTemplateView[];
  awards: CertificateAwardView[];
};

type IssueTrigger = {
  kind: Exclude<CertificateAwardKind, "manual">;
  studentUserId: string;
  sourceId: string;
  sourceTitle: string;
  subjectSlug: string | null;
  percent: number;
};

function isStaffCertificates(actor: ApiActor) {
  return hasAnyPermission(actor, "academic.certificates");
}

function isStaffAcademic(actor: ApiActor) {
  return hasAnyPermission(actor, [
    "academic.certificates",
    "academic.curriculum",
    "reports.academic",
  ]);
}

function certificatesPath(actor: ApiActor, studentUserId?: string) {
  return certificatesHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffAcademic(actor),
    studentUserId,
  );
}

function awardPath(actor: ApiActor, awardId: string) {
  return certificateAwardHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffAcademic(actor),
    awardId,
  );
}

function formatAwardDate(value: Date) {
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function parseAwardKind(value: string): CertificateAwardKind {
  return isCertificateAwardKind(value) ? value : "manual";
}

function neededPercent(kind: CertificateAwardKind, passPercent: number) {
  if (kind === "course" && passPercent <= 0) return 100;
  return passPercent;
}

async function canIssueCertificates(actor: ApiActor) {
  if (isStaffCertificates(actor) || hasAnyPermission(actor, "academic.curriculum")) {
    return true;
  }
  if (actor.roleKey !== "teacher") return false;
  const status = await getTeacherVerificationStatus(actor.userId);
  return status === "approved";
}

async function namesFor(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((row) => [row.id, row.name ?? "Student"]));
}

async function listTeacherLearnerIds(teacherUserId: string) {
  const [quizRows, examRows, courseRows, lessonRows] = await Promise.all([
    db
      .selectDistinct({ id: quizAttempts.studentUserId })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
      .where(eq(quizzes.createdByUserId, teacherUserId)),
    db
      .selectDistinct({ id: examSittings.studentUserId })
      .from(examSittings)
      .innerJoin(exams, eq(exams.id, examSittings.examId))
      .where(eq(exams.createdByUserId, teacherUserId)),
    db
      .selectDistinct({ id: prerecordedCourseProgress.studentUserId })
      .from(prerecordedCourseProgress)
      .innerJoin(
        prerecordedCourses,
        eq(prerecordedCourses.id, prerecordedCourseProgress.courseId),
      )
      .where(eq(prerecordedCourses.createdByUserId, teacherUserId)),
    db
      .selectDistinct({ id: lessonHistory.studentUserId })
      .from(lessonHistory)
      .where(eq(lessonHistory.teacherUserId, teacherUserId)),
  ]);
  return new Set(
    [...quizRows, ...examRows, ...courseRows, ...lessonRows].map((row) => row.id),
  );
}

async function listLearners(actor: ApiActor) {
  if (actor.roleKey === "student") {
    const [user] = await db
      .select({ name: users.displayName })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1);
    return [
      {
        studentUserId: actor.userId,
        name: user?.name ?? "Student",
        href: certificatesPath(actor, actor.userId),
      },
    ];
  }
  if (actor.roleKey === "parent") {
    const children = await db
      .select({
        id: parentChildren.childUserId,
        name: users.displayName,
      })
      .from(parentChildren)
      .innerJoin(users, eq(users.id, parentChildren.childUserId))
      .where(eq(parentChildren.parentUserId, actor.userId));
    return children.map((child) => ({
      studentUserId: child.id,
      name: child.name ?? "Student",
      href: familyChildCertificatesHref(child.id),
    }));
  }
  if (actor.roleKey === "teacher" && !isStaffAcademic(actor)) {
    const ids = [...(await listTeacherLearnerIds(actor.userId))];
    const names = await namesFor(ids);
    return ids
      .map((id) => ({
        studentUserId: id,
        name: names.get(id) ?? "Student",
        href: certificatesPath(actor, id),
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 60);
  }
  if (isStaffAcademic(actor)) {
    const recent = await db
      .select({ id: quizAttempts.studentUserId })
      .from(quizAttempts)
      .groupBy(quizAttempts.studentUserId)
      .orderBy(desc(sql`max(${quizAttempts.submittedAt})`))
      .limit(40);
    const extra = await db
      .select({ id: examSittings.studentUserId })
      .from(examSittings)
      .groupBy(examSittings.studentUserId)
      .orderBy(desc(sql`max(${examSittings.startedAt})`))
      .limit(40);
    const ids = [...new Set([...recent, ...extra].map((row) => row.id))].slice(
      0,
      60,
    );
    const names = await namesFor(ids);
    return ids
      .map((id) => ({
        studentUserId: id,
        name: names.get(id) ?? "Student",
        href: certificatesPath(actor, id),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
  return [];
}

async function assertCanViewStudent(actor: ApiActor, studentUserId: string) {
  if (actor.roleKey === "student" && actor.userId === studentUserId) return;
  if (actor.roleKey === "parent") {
    await assertParentOwnsChild(actor.userId, studentUserId);
    return;
  }
  if (isStaffAcademic(actor)) return;
  if (actor.roleKey === "teacher") {
    const known = await listTeacherLearnerIds(actor.userId);
    if (known.has(studentUserId)) return;
    throw new ApiError(403, "FORBIDDEN", "You cannot view this certificate");
  }
  throw new ApiError(403, "FORBIDDEN", "You cannot view this certificate");
}

async function assertCanIssueTo(actor: ApiActor, studentUserId: string) {
  if (!(await canIssueCertificates(actor))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot issue certificates");
  }
  const [student] = await db
    .select({ userId: studentProfiles.userId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, studentUserId))
    .limit(1);
  if (!student) {
    throw new ApiError(404, "NOT_FOUND", "Student not found");
  }
  if (isStaffAcademic(actor)) return;
  const known = await listTeacherLearnerIds(actor.userId);
  if (!known.has(studentUserId)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot issue a certificate to this student");
  }
}

async function loadSources() {
  const [quizRows, examRows, courseRows] = await Promise.all([
    db
      .select({ id: quizzes.id, title: quizzes.title })
      .from(quizzes)
      .orderBy(desc(quizzes.createdAt))
      .limit(80),
    db
      .select({ id: exams.id, title: exams.title })
      .from(exams)
      .orderBy(desc(exams.createdAt))
      .limit(80),
    db
      .select({ id: prerecordedCourses.id, title: prerecordedCourses.title })
      .from(prerecordedCourses)
      .orderBy(desc(prerecordedCourses.createdAt))
      .limit(80),
  ]);
  return [
    ...quizRows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: "quiz" as const,
    })),
    ...examRows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: "exam" as const,
    })),
    ...courseRows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: "course" as const,
    })),
  ];
}

function toTemplateView(
  row: {
    id: string;
    name: string;
    subjectSlug: string | null;
    subjectName: string | null;
    status: CertificateStatus;
    description: string | null;
    heading: string;
    body: string | null;
    signOff: string;
    awardKind: string;
    awardSourceId: string | null;
    passPercent: number;
    autoIssue: boolean;
  },
  sources: CertificateSourceOption[],
): CertificateTemplateView {
  const awardKind = parseAwardKind(row.awardKind);
  return {
    id: row.id,
    name: row.name,
    subjectSlug: row.subjectSlug,
    subjectName: row.subjectName,
    status: row.status,
    description: row.description,
    heading: row.heading || CERTIFICATE_DEFAULT_HEADING,
    body: row.body?.trim() || CERTIFICATE_DEFAULT_BODY,
    signOff: row.signOff || CERTIFICATE_DEFAULT_SIGN_OFF,
    awardKind,
    awardSourceId: row.awardSourceId,
    sourceTitle:
      sources.find((source) => source.id === row.awardSourceId)?.title ?? null,
    passPercent: row.passPercent,
    autoIssue: row.autoIssue,
  };
}

async function upsertAward(input: {
  template: CertificateTemplateView;
  studentUserId: string;
  studentName: string;
  issuedByUserId: string | null;
  sourceKind: CertificateAwardKind;
  sourceId: string | null;
  sourceTitle: string;
  subjectName: string | null;
}) {
  const issuedAt = new Date();
  const body = renderCertificateBody(input.template.body, {
    student: input.studentName,
    title: input.sourceTitle,
    subject: input.subjectName ?? input.template.subjectName ?? "your studies",
    date: formatAwardDate(issuedAt),
    school: input.template.signOff,
  });
  const [award] = await db
    .insert(certificateAwards)
    .values({
      certificateId: input.template.id,
      studentUserId: input.studentUserId,
      issuedByUserId: input.issuedByUserId,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      sourceTitle: input.sourceTitle,
      heading: input.template.heading,
      body,
      signOff: input.template.signOff,
      issuedAt,
    })
    .onConflictDoUpdate({
      target: [
        certificateAwards.certificateId,
        certificateAwards.studentUserId,
      ],
      set: {
        issuedByUserId: input.issuedByUserId,
        sourceKind: input.sourceKind,
        sourceId: input.sourceId,
        sourceTitle: input.sourceTitle,
        heading: input.template.heading,
        body,
        signOff: input.template.signOff,
        issuedAt,
      },
    })
    .returning();
  return award;
}

async function latestQuizResult(
  studentUserId: string,
  quizId?: string | null,
) {
  const filters = [
    eq(quizAttempts.studentUserId, studentUserId),
    sql`${quizAttempts.markingStatus} <> 'pending'`,
  ];
  if (quizId) filters.push(eq(quizAttempts.quizId, quizId));
  const [row] = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      subjectSlug: quizzes.subjectSlug,
      subjectName: subjects.name,
      percent: quizAttempts.percent,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .leftJoin(subjects, eq(subjects.slug, quizzes.subjectSlug))
    .where(and(...filters))
    .orderBy(desc(quizAttempts.submittedAt))
    .limit(1);
  return row ?? null;
}

async function latestExamResult(
  studentUserId: string,
  examId?: string | null,
) {
  const filters = [
    eq(examSittings.studentUserId, studentUserId),
    sql`${examSittings.submittedAt} is not null`,
    sql`${examSittings.markingStatus} <> 'pending'`,
  ];
  if (examId) filters.push(eq(examSittings.examId, examId));
  const [row] = await db
    .select({
      id: exams.id,
      title: exams.title,
      subjectSlug: exams.subjectSlug,
      subjectName: subjects.name,
      percent: examSittings.percent,
    })
    .from(examSittings)
    .innerJoin(exams, eq(exams.id, examSittings.examId))
    .leftJoin(subjects, eq(subjects.slug, exams.subjectSlug))
    .where(and(...filters))
    .orderBy(desc(examSittings.submittedAt))
    .limit(1);
  return row ?? null;
}

async function courseResult(studentUserId: string, courseId: string) {
  const [course] = await db
    .select({
      id: prerecordedCourses.id,
      title: prerecordedCourses.title,
      subjectSlug: prerecordedCourses.subjectSlug,
      subjectName: subjects.name,
    })
    .from(prerecordedCourses)
    .leftJoin(subjects, eq(subjects.slug, prerecordedCourses.subjectSlug))
    .where(eq(prerecordedCourses.id, courseId))
    .limit(1);
  if (!course) return null;
  const [lessonCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(prerecordedCourseLessons)
    .where(eq(prerecordedCourseLessons.courseId, courseId));
  const [completed] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(prerecordedCourseProgress)
    .where(
      and(
        eq(prerecordedCourseProgress.courseId, courseId),
        eq(prerecordedCourseProgress.studentUserId, studentUserId),
        sql`${prerecordedCourseProgress.completedAt} is not null`,
      ),
    );
  return {
    ...course,
    percent: libraryCourseProgressPercent(
      completed?.count ?? 0,
      lessonCount?.count ?? 0,
    ),
  };
}

function templateMatchesTrigger(
  template: CertificateTemplateView,
  trigger: IssueTrigger,
) {
  if (template.status !== "active") return false;
  if (template.awardKind !== trigger.kind) return false;
  if (template.awardSourceId && template.awardSourceId !== trigger.sourceId) {
    return false;
  }
  if (template.subjectSlug && template.subjectSlug !== trigger.subjectSlug) {
    return false;
  }
  return trigger.percent >= neededPercent(template.awardKind, template.passPercent);
}

async function resolveIssueSource(
  template: CertificateTemplateView,
  studentUserId: string,
): Promise<{
  sourceKind: CertificateAwardKind;
  sourceId: string | null;
  sourceTitle: string;
  subjectName: string | null;
  percent: number;
} | null> {
  if (template.awardKind === "manual") {
    return {
      sourceKind: "manual",
      sourceId: null,
      sourceTitle: template.name,
      subjectName: template.subjectName,
      percent: 100,
    };
  }
  if (template.awardKind === "quiz") {
    const row = await latestQuizResult(studentUserId, template.awardSourceId);
    if (!row) return null;
    if (template.subjectSlug && row.subjectSlug !== template.subjectSlug) {
      return null;
    }
    if ((row.percent ?? 0) < neededPercent("quiz", template.passPercent)) {
      return null;
    }
    return {
      sourceKind: "quiz",
      sourceId: row.id,
      sourceTitle: row.title,
      subjectName: row.subjectName,
      percent: row.percent ?? 0,
    };
  }
  if (template.awardKind === "exam") {
    const row = await latestExamResult(studentUserId, template.awardSourceId);
    if (!row) return null;
    if (template.subjectSlug && row.subjectSlug !== template.subjectSlug) {
      return null;
    }
    if ((row.percent ?? 0) < neededPercent("exam", template.passPercent)) {
      return null;
    }
    return {
      sourceKind: "exam",
      sourceId: row.id,
      sourceTitle: row.title,
      subjectName: row.subjectName,
      percent: row.percent ?? 0,
    };
  }
  if (!template.awardSourceId) return null;
  const row = await courseResult(studentUserId, template.awardSourceId);
  if (!row) return null;
  if (template.subjectSlug && row.subjectSlug !== template.subjectSlug) {
    return null;
  }
  if (row.percent < neededPercent("course", template.passPercent)) return null;
  return {
    sourceKind: "course",
    sourceId: row.id,
    sourceTitle: row.title,
    subjectName: row.subjectName,
    percent: row.percent,
  };
}

async function loadTemplateRows() {
  return db
    .select({
      id: certificates.id,
      name: certificates.name,
      subjectSlug: certificates.subjectSlug,
      subjectName: subjects.name,
      status: certificates.status,
      description: certificates.description,
      heading: certificates.heading,
      body: certificates.body,
      signOff: certificates.signOff,
      awardKind: certificates.awardKind,
      awardSourceId: certificates.awardSourceId,
      passPercent: certificates.passPercent,
      autoIssue: certificates.autoIssue,
    })
    .from(certificates)
    .leftJoin(subjects, eq(certificates.subjectSlug, subjects.slug))
    .orderBy(desc(certificates.updatedAt));
}

function toAwardView(
  actor: ApiActor,
  row: {
    id: string;
    certificateId: string;
    certificateName: string;
    studentUserId: string;
    studentName: string | null;
    issuedByUserId: string | null;
    sourceKind: string;
    sourceId: string | null;
    sourceTitle: string | null;
    heading: string;
    body: string;
    signOff: string;
    issuedAt: Date;
  },
): CertificateAwardView {
  return {
    id: row.id,
    certificateId: row.certificateId,
    certificateName: row.certificateName,
    studentUserId: row.studentUserId,
    studentName: row.studentName ?? "Student",
    issuedByUserId: row.issuedByUserId,
    sourceKind: parseAwardKind(row.sourceKind),
    sourceId: row.sourceId,
    sourceTitle: row.sourceTitle,
    heading: row.heading,
    body: row.body,
    signOff: row.signOff,
    issuedAt: row.issuedAt.toISOString(),
    href: awardPath(actor, row.id),
  };
}

export async function getCertificateDesk(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<CertificateDesk> {
  const learners = await listLearners(actor);
  const requested = options?.studentUserId;
  if (requested) await assertCanViewStudent(actor, requested);
  const selected =
    requested && learners.some((row) => row.studentUserId === requested)
      ? requested
      : actor.roleKey === "student"
        ? actor.userId
        : learners.length === 1
          ? learners[0]?.studentUserId
          : requested;
  const studentFilter = selected
    ? [eq(certificateAwards.studentUserId, selected)]
    : actor.roleKey === "parent"
      ? learners.length
        ? [inArray(
            certificateAwards.studentUserId,
            learners.map((row) => row.studentUserId),
          )]
        : [sql`false`]
      : actor.roleKey === "teacher" && !isStaffAcademic(actor)
        ? learners.length
          ? [inArray(
              certificateAwards.studentUserId,
              learners.map((row) => row.studentUserId),
            )]
          : [sql`false`]
        : [];

  const [subjectRows, sources, templateRows, awardRows] = await Promise.all([
    db
      .select({ slug: subjects.slug, name: subjects.name })
      .from(subjects)
      .orderBy(subjects.sortOrder),
    loadSources(),
    loadTemplateRows(),
    db
      .select({
        id: certificateAwards.id,
        certificateId: certificateAwards.certificateId,
        certificateName: certificates.name,
        studentUserId: certificateAwards.studentUserId,
        studentName: users.displayName,
        issuedByUserId: certificateAwards.issuedByUserId,
        sourceKind: certificateAwards.sourceKind,
        sourceId: certificateAwards.sourceId,
        sourceTitle: certificateAwards.sourceTitle,
        heading: certificateAwards.heading,
        body: certificateAwards.body,
        signOff: certificateAwards.signOff,
        issuedAt: certificateAwards.issuedAt,
      })
      .from(certificateAwards)
      .innerJoin(certificates, eq(certificates.id, certificateAwards.certificateId))
      .innerJoin(users, eq(users.id, certificateAwards.studentUserId))
      .where(studentFilter.length ? and(...studentFilter) : undefined)
      .orderBy(desc(certificateAwards.issuedAt))
      .limit(80),
  ]);

  const templates = templateRows.map((row) => toTemplateView(row, sources));
  return {
    href: certificatesPath(actor, selected),
    canManageTemplates: isStaffCertificates(actor),
    canIssue: await canIssueCertificates(actor),
    learners,
    subjects: subjectRows,
    sources,
    templates:
      isStaffCertificates(actor) || (await canIssueCertificates(actor))
        ? isStaffCertificates(actor)
          ? templates
          : templates.filter((item) => item.status === "active")
        : [],
    awards: awardRows.map((row) => toAwardView(actor, row)),
  };
}

export async function getCertificateAward(actor: ApiActor, awardId: string) {
  const [row] = await db
    .select({
      id: certificateAwards.id,
      certificateId: certificateAwards.certificateId,
      certificateName: certificates.name,
      studentUserId: certificateAwards.studentUserId,
      studentName: users.displayName,
      issuedByUserId: certificateAwards.issuedByUserId,
      sourceKind: certificateAwards.sourceKind,
      sourceId: certificateAwards.sourceId,
      sourceTitle: certificateAwards.sourceTitle,
      heading: certificateAwards.heading,
      body: certificateAwards.body,
      signOff: certificateAwards.signOff,
      issuedAt: certificateAwards.issuedAt,
    })
    .from(certificateAwards)
    .innerJoin(certificates, eq(certificates.id, certificateAwards.certificateId))
    .innerJoin(users, eq(users.id, certificateAwards.studentUserId))
    .where(eq(certificateAwards.id, awardId))
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Certificate not found");
  }
  await assertCanViewStudent(actor, row.studentUserId);
  return toAwardView(actor, row);
}

export async function saveCertificateTemplate(
  actor: ApiActor,
  input: {
    id?: string;
    name: string;
    subjectSlug?: string | null;
    description?: string | null;
    heading?: string;
    body?: string | null;
    signOff?: string;
    awardKind?: CertificateAwardKind;
    awardSourceId?: string | null;
    passPercent?: number;
    autoIssue?: boolean;
    status?: CertificateStatus;
  },
  ip: string,
) {
  if (!isStaffCertificates(actor)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot edit certificate templates");
  }
  const subjectSlug = input.subjectSlug?.trim() || null;
  if (subjectSlug) {
    const [subject] = await db
      .select({ slug: subjects.slug })
      .from(subjects)
      .where(eq(subjects.slug, subjectSlug))
      .limit(1);
    if (!subject) {
      throw new ApiError(404, "NOT_FOUND", "Subject not found");
    }
  }
  const awardKind = input.awardKind ?? "manual";
  const awardSourceId = awardKind === "manual" ? null : input.awardSourceId ?? null;
  const values = {
    name: input.name.trim(),
    subjectSlug,
    description: input.description?.trim() || null,
    heading: input.heading?.trim() || CERTIFICATE_DEFAULT_HEADING,
    body: input.body?.trim() || null,
    signOff: input.signOff?.trim() || CERTIFICATE_DEFAULT_SIGN_OFF,
    awardKind,
    awardSourceId,
    passPercent:
      input.passPercent === undefined
        ? undefined
        : Math.min(100, Math.max(0, Math.round(input.passPercent))),
    autoIssue: awardKind === "manual" ? false : Boolean(input.autoIssue),
    status: input.status,
  };

  if (input.id) {
    const [updated] = await db
      .update(certificates)
      .set({
        ...(values.name ? { name: values.name } : {}),
        subjectSlug: values.subjectSlug,
        description: values.description,
        heading: values.heading,
        body: values.body,
        signOff: values.signOff,
        awardKind: values.awardKind,
        awardSourceId: values.awardSourceId,
        ...(values.passPercent !== undefined
          ? { passPercent: values.passPercent }
          : {}),
        autoIssue: values.autoIssue,
        ...(values.status ? { status: values.status } : {}),
      })
      .where(eq(certificates.id, input.id))
      .returning({ id: certificates.id });
    if (!updated) {
      throw new ApiError(404, "NOT_FOUND", "Certificate not found");
    }
    await writeAuditLog({
      actor,
      action: "lms.certificate.template_saved",
      entityType: "certificate",
      entityId: input.id,
      ipAddress: ip,
      metadata: { awardKind, autoIssue: values.autoIssue },
    });
    return getCertificateDesk(actor);
  }

  const [created] = await db
    .insert(certificates)
    .values({
      name: values.name,
      subjectSlug: values.subjectSlug,
      description: values.description,
      heading: values.heading,
      body: values.body,
      signOff: values.signOff,
      awardKind: values.awardKind,
      awardSourceId: values.awardSourceId,
      passPercent: values.passPercent ?? 0,
      autoIssue: values.autoIssue,
      status: values.status ?? "draft",
      createdByUserId: actor.userId,
    })
    .returning({ id: certificates.id });
  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not create the certificate");
  }
  await writeAuditLog({
    actor,
    action: "lms.certificate.template_created",
    entityType: "certificate",
    entityId: created.id,
    ipAddress: ip,
    metadata: { awardKind },
  });
  return getCertificateDesk(actor);
}

export async function issueCertificate(
  actor: ApiActor,
  input: { certificateId: string; studentUserId: string },
  ip: string,
) {
  requireHumanSensitiveDecision();
  await assertCanIssueTo(actor, input.studentUserId);
  const sources = await loadSources();
  const [row] = await db
    .select({
      id: certificates.id,
      name: certificates.name,
      subjectSlug: certificates.subjectSlug,
      subjectName: subjects.name,
      status: certificates.status,
      description: certificates.description,
      heading: certificates.heading,
      body: certificates.body,
      signOff: certificates.signOff,
      awardKind: certificates.awardKind,
      awardSourceId: certificates.awardSourceId,
      passPercent: certificates.passPercent,
      autoIssue: certificates.autoIssue,
    })
    .from(certificates)
    .leftJoin(subjects, eq(certificates.subjectSlug, subjects.slug))
    .where(eq(certificates.id, input.certificateId))
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Certificate template not found");
  }
  const template = toTemplateView(row, sources);
  if (template.status !== "active") {
    throw new ApiError(422, "VALIDATION", "Activate this template before issuing it");
  }
  const source = await resolveIssueSource(template, input.studentUserId);
  if (!source) {
    throw new ApiError(
      422,
      "VALIDATION",
      "This student has not met the template requirements",
    );
  }
  const [student] = await db
    .select({ name: users.displayName })
    .from(users)
    .where(eq(users.id, input.studentUserId))
    .limit(1);
  await upsertAward({
    template,
    studentUserId: input.studentUserId,
    studentName: student?.name ?? "Student",
    issuedByUserId: actor.userId,
    sourceKind: source.sourceKind,
    sourceId: source.sourceId,
    sourceTitle: source.sourceTitle,
    subjectName: source.subjectName,
  });
  await safeAwardGamification({
    kind: "certificate",
    studentUserId: input.studentUserId,
    sourceId: template.id,
    title: template.name,
  });
  await writeAuditLog({
    actor,
    action: "lms.certificate.issued",
    entityType: "certificate",
    entityId: template.id,
    ipAddress: ip,
    metadata: {
      studentUserId: input.studentUserId,
      sourceKind: source.sourceKind,
      sourceId: source.sourceId,
    },
  });
  return getCertificateDesk(actor, { studentUserId: input.studentUserId });
}

export async function maybeIssueCertificates(
  actor: ApiActor,
  trigger: IssueTrigger,
) {
  const sources = await loadSources();
  const templates = (await loadTemplateRows())
    .map((row) => toTemplateView(row, sources))
    .filter((template) => template.autoIssue && templateMatchesTrigger(template, trigger));
  if (!templates.length) return;
  const [student] = await db
    .select({ name: users.displayName })
    .from(users)
    .where(eq(users.id, trigger.studentUserId))
    .limit(1);
  for (const template of templates) {
    await upsertAward({
      template,
      studentUserId: trigger.studentUserId,
      studentName: student?.name ?? "Student",
      issuedByUserId: actor.userId,
      sourceKind: trigger.kind,
      sourceId: trigger.sourceId,
      sourceTitle: trigger.sourceTitle,
      subjectName: template.subjectName,
    });
    await safeAwardGamification({
      kind: "certificate",
      studentUserId: trigger.studentUserId,
      sourceId: template.id,
      title: template.name,
    });
  }
}

export async function safeMaybeIssueCertificates(
  actor: ApiActor,
  trigger: IssueTrigger,
) {
  try {
    await maybeIssueCertificates(actor, trigger);
  } catch {
    // Certificate generation must never fail a sit, mark, or progress save.
  }
}
