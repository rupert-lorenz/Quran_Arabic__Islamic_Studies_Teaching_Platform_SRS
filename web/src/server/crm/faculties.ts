import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
  type AnyColumn,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  bookings,
  certificateAwards,
  crmAccounts,
  crmNotes,
  currencies,
  examSittings,
  exams,
  financeOperations,
  homeworkWork,
  homeworks,
  liveCourseEnrollments,
  liveCourses,
  marketingCampaigns,
  quizAttempts,
  quizzes,
  roles,
  sessions,
  supportTicketAttachments,
  supportTickets,
  teacherProfiles,
  users,
} from "@/db/schema";
import type { CrmReport } from "@/lib/crm";
import type { ApiActor } from "@/server/api/auth";
import { formatMinorAmount } from "@/server/staff/money";
import { helpCounts } from "./help";
import { bookingScope, childIdsFor, crmFlags, learnerIds, openWhere } from "./scope";

type Row = { id: string; title: string; meta: string };

function num(value: unknown) {
  return Number(value ?? 0);
}

function rate(part: number, whole: number) {
  if (!whole) return null;
  return `${Math.round((part / whole) * 100)}%`;
}

async function one(query: Promise<{ value: unknown }[]>) {
  const [row] = await query;
  return num(row?.value);
}

export async function getCrmFaculties(actor: ApiActor) {
  const flags = crmFlags(actor);
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [scope, learners, help, currencyRows] = await Promise.all([
    bookingScope(actor),
    learnerIds(actor),
    helpCounts(),
    db
      .select({
        code: currencies.code,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(currencies),
  ]);
  const money = new Map(currencyRows.map((row) => [row.code, row]));
  const label = (amount: number, code: string) => {
    const currency = money.get(code);
    return currency
      ? formatMinorAmount(amount, currency.decimalPlaces, currency.symbol)
      : `${amount} ${code}`;
  };
  const learnerFilter = (column: AnyColumn) =>
    learners === null ? sql`true` : learners.length ? inArray(column, learners) : sql`false`;

  const ticketScope = flags.canTickets
    ? sql`true`
    : eq(supportTickets.createdByUserId, actor.userId);
  const sessionScope =
    flags.staff && flags.canUsers ? sql`true` : eq(sessions.userId, actor.userId);
  const financeScope =
    flags.staff && flags.canFinance
      ? sql`true`
      : flags.teacher
        ? eq(financeOperations.counterpartyUserId, actor.userId)
        : flags.parent || flags.student
          ? and(
              eq(financeOperations.counterpartyUserId, actor.userId),
              ne(financeOperations.kind, "payout"),
            )
          : sql`false`;
  const showFinance = flags.canFinance || flags.teacher || flags.parent || flags.student;
  const showPayouts = flags.canFinance || flags.teacher;
  const showAcademic = (flags.staff && flags.canAcademic) || !flags.staff;

  const studentUser = alias(users, "crm_student");
  const [
    pipeline,
    leadRows,
    followUpRows,
    ticketCounts,
    ticketRows,
    attachmentCount,
    categoryRows,
    userRows,
    sessionCounts,
    financeRows,
    retentionRow,
    trialRow,
    homeworkCount,
    examCount,
    quizCount,
    certificateCount,
    campaignRows,
    teacherKept,
    teachers,
    studentKept,
    students,
    revenueTeachers,
    revenueCourses,
    revenueCountries,
    revenueSubjects,
    revenueMonths,
  ] = await Promise.all([
    flags.canCrm
      ? db
          .select({
            lead: sql<number>`count(*) filter (where ${crmAccounts.status} = 'lead')`,
            registered: sql<number>`count(*) filter (where ${crmAccounts.status} = 'registered')`,
            trialBooked: sql<number>`count(*) filter (where ${crmAccounts.status} = 'trial_booked')`,
            trialCompleted: sql<number>`count(*) filter (where ${crmAccounts.status} = 'trial_completed')`,
            active: sql<number>`count(*) filter (where ${crmAccounts.status} = 'active')`,
            inactive: sql<number>`count(*) filter (where ${crmAccounts.status} = 'inactive')`,
            cancelled: sql<number>`count(*) filter (where ${crmAccounts.status} = 'cancelled')`,
          })
          .from(crmAccounts)
      : Promise.resolve([]),
    flags.canCrm
      ? db
          .select({
            id: crmAccounts.id,
            name: crmAccounts.name,
            status: crmAccounts.status,
            createdAt: crmAccounts.createdAt,
          })
          .from(crmAccounts)
          .orderBy(desc(crmAccounts.createdAt))
          .limit(8)
      : Promise.resolve([]),
    flags.canCrm
      ? db
          .select({
            id: crmNotes.id,
            body: crmNotes.body,
            followUpOn: crmNotes.followUpOn,
            name: crmAccounts.name,
          })
          .from(crmNotes)
          .innerJoin(crmAccounts, eq(crmNotes.accountId, crmAccounts.id))
          .where(isNotNull(crmNotes.followUpOn))
          .orderBy(crmNotes.followUpOn)
          .limit(8)
      : Promise.resolve([]),
    db
      .select({
        open: sql<number>`count(*) filter (where ${supportTickets.status} in ('open','in_progress'))`,
        waiting: sql<number>`count(*) filter (where ${supportTickets.status} = 'waiting')`,
        closed: sql<number>`count(*) filter (where ${supportTickets.status} in ('resolved','closed'))`,
        mine: sql<number>`count(*) filter (where ${supportTickets.createdByUserId} = ${actor.userId} and ${supportTickets.status} not in ('resolved','closed'))`,
        unassigned: sql<number>`count(*) filter (where ${supportTickets.ownerUserId} is null and ${supportTickets.status} not in ('resolved','closed'))`,
      })
      .from(supportTickets)
      .where(ticketScope),
    db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        status: supportTickets.status,
        category: supportTickets.category,
        priority: supportTickets.priority,
      })
      .from(supportTickets)
      .where(ticketScope)
      .orderBy(desc(supportTickets.createdAt))
      .limit(8),
    one(
      db
        .select({ value: sql<number>`count(distinct ${supportTicketAttachments.ticketId})` })
        .from(supportTicketAttachments)
        .innerJoin(supportTickets, eq(supportTicketAttachments.ticketId, supportTickets.id))
        .where(ticketScope),
    ),
    db
      .select({
        category: supportTickets.category,
        value: count(),
      })
      .from(supportTickets)
      .where(ticketScope)
      .groupBy(supportTickets.category)
      .orderBy(desc(count()))
      .limit(6),
    flags.canUsers
      ? db
          .select({ key: roles.key, value: count() })
          .from(users)
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(isNull(users.deletedAt))
          .groupBy(roles.key)
      : Promise.resolve([]),
    Promise.all([
      one(
        db
          .select({ value: count() })
          .from(sessions)
          .where(and(sessionScope, gt(sessions.expiresAt, new Date()))),
      ),
      one(
        db
          .select({ value: count() })
          .from(sessions)
          .where(and(sessionScope, gte(sessions.createdAt, since30))),
      ),
      one(
        db
          .select({ value: sql<number>`count(distinct ${sessions.userId})` })
          .from(sessions)
          .where(and(sessionScope, gte(sessions.createdAt, since30))),
      ),
    ]),
    showFinance
      ? db
          .select({
            kind: financeOperations.kind,
            status: financeOperations.status,
            currencyCode: financeOperations.currencyCode,
            amount: sql<number>`sum(${financeOperations.amountMinor})`,
            value: count(),
          })
          .from(financeOperations)
          .where(financeScope)
          .groupBy(
            financeOperations.kind,
            financeOperations.status,
            financeOperations.currencyCode,
          )
          .orderBy(desc(count()))
          .limit(8)
      : Promise.resolve([]),
    db
      .select({
        completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
        cancelled: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')`,
      })
      .from(bookings)
      .where(openWhere(scope)),
    db
      .select({
        booked: sql<number>`count(*) filter (where ${bookings.kind} = 'trial')`,
        completed: sql<number>`count(*) filter (where ${bookings.kind} = 'trial' and ${bookings.status} = 'completed')`,
        converted: sql<number>`count(distinct ${bookings.studentUserId}) filter (where ${bookings.kind} = 'trial' and ${bookings.status} <> 'cancelled' and exists (
          select 1 from ${bookings} lesson
          where lesson.student_user_id = ${bookings.studentUserId}
            and lesson.kind = 'lesson'
            and lesson.status in ('confirmed','completed')
            ${flags.teacher ? sql`and lesson.teacher_user_id = ${actor.userId}` : sql``}
        ))`,
      })
      .from(bookings)
      .where(openWhere(scope)),
    showAcademic
      ? flags.teacher
        ? one(
            db
              .select({ value: count() })
              .from(homeworks)
              .where(eq(homeworks.createdByUserId, actor.userId)),
          )
        : one(
            db
              .select({ value: count() })
              .from(homeworkWork)
              .where(flags.staff ? sql`true` : learnerFilter(homeworkWork.studentUserId)),
          )
      : Promise.resolve(0),
    showAcademic
      ? one(
          db
            .select({ value: count() })
            .from(examSittings)
            .innerJoin(exams, eq(examSittings.examId, exams.id))
            .where(
              flags.teacher
                ? eq(exams.createdByUserId, actor.userId)
                : flags.staff
                  ? sql`true`
                  : learnerFilter(examSittings.studentUserId),
            ),
        )
      : Promise.resolve(0),
    showAcademic
      ? one(
          db
            .select({ value: count() })
            .from(quizAttempts)
            .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
            .where(
              flags.teacher
                ? eq(quizzes.createdByUserId, actor.userId)
                : flags.staff
                  ? sql`true`
                  : learnerFilter(quizAttempts.studentUserId),
            ),
        )
      : Promise.resolve(0),
    showAcademic
      ? one(
          db
            .select({ value: count() })
            .from(certificateAwards)
            .where(
              flags.teacher
                ? eq(certificateAwards.issuedByUserId, actor.userId)
                : flags.staff
                  ? sql`true`
                  : learnerFilter(certificateAwards.studentUserId),
            ),
        )
      : Promise.resolve(0),
    flags.canMarketing
      ? db
          .select({ status: marketingCampaigns.status, value: count() })
          .from(marketingCampaigns)
          .groupBy(marketingCampaigns.status)
      : Promise.resolve([]),
    flags.staff
      ? one(
          db
            .select({ value: sql<number>`count(distinct ${bookings.teacherUserId})` })
            .from(bookings)
            .innerJoin(teacherProfiles, eq(bookings.teacherUserId, teacherProfiles.userId))
            .where(
              and(
                eq(bookings.status, "completed"),
                gte(bookings.startsAt, since90),
                eq(teacherProfiles.verificationStatus, "approved"),
              ),
            ),
        )
      : flags.teacher
        ? one(
            db
              .select({ value: count() })
              .from(bookings)
              .where(
                and(
                  eq(bookings.teacherUserId, actor.userId),
                  eq(bookings.status, "completed"),
                  gte(bookings.startsAt, since90),
                ),
              ),
          )
        : Promise.resolve(0),
    flags.staff
      ? one(
          db
            .select({ value: count() })
            .from(teacherProfiles)
            .where(eq(teacherProfiles.verificationStatus, "approved")),
        )
      : Promise.resolve(flags.teacher ? 1 : 0),
    one(
      db
        .select({ value: sql<number>`count(distinct ${bookings.studentUserId})` })
        .from(bookings)
        .where(
          openWhere(
            scope,
            and(eq(bookings.status, "completed"), gte(bookings.startsAt, since90)),
          ),
        ),
    ),
    one(
      db
        .select({ value: sql<number>`count(distinct ${bookings.studentUserId})` })
        .from(bookings)
        .where(openWhere(scope)),
    ),
    flags.canRevenue || flags.teacher
      ? db
          .select({
            name: users.displayName,
            currencyCode: bookings.currencyCode,
            amount: sql<number>`sum(${bookings.amountMinor})`,
            value: count(),
          })
          .from(bookings)
          .innerJoin(users, eq(bookings.teacherUserId, users.id))
          .where(openWhere(scope, eq(bookings.status, "completed")))
          .groupBy(users.displayName, bookings.currencyCode)
          .orderBy(desc(sql`sum(${bookings.amountMinor})`))
          .limit(6)
      : Promise.resolve([]),
    flags.canRevenue || flags.teacher
      ? db
          .select({
            name: liveCourses.title,
            currencyCode: liveCourseEnrollments.currencyCode,
            amount: sql<number>`sum(${liveCourseEnrollments.amountMinor})`,
            value: count(),
          })
          .from(liveCourseEnrollments)
          .innerJoin(liveCourses, eq(liveCourseEnrollments.liveCourseId, liveCourses.id))
          .where(
            and(
              inArray(liveCourseEnrollments.status, ["confirmed", "completed"]),
              flags.teacher ? eq(liveCourses.teacherUserId, actor.userId) : sql`true`,
              flags.parent
                ? learnerFilter(liveCourseEnrollments.studentUserId)
                : flags.student
                  ? eq(liveCourseEnrollments.studentUserId, actor.userId)
                  : sql`true`,
            ),
          )
          .groupBy(liveCourses.title, liveCourseEnrollments.currencyCode)
          .orderBy(desc(sql`sum(${liveCourseEnrollments.amountMinor})`))
          .limit(6)
      : Promise.resolve([]),
    flags.canRevenue || flags.teacher
      ? db
          .select({
            name: sql<string>`coalesce(${studentUser.country}, '—')`,
            currencyCode: bookings.currencyCode,
            amount: sql<number>`sum(${bookings.amountMinor})`,
            value: count(),
          })
          .from(bookings)
          .innerJoin(studentUser, eq(bookings.studentUserId, studentUser.id))
          .where(openWhere(scope, eq(bookings.status, "completed")))
          .groupBy(studentUser.country, bookings.currencyCode)
          .orderBy(desc(sql`sum(${bookings.amountMinor})`))
          .limit(6)
      : Promise.resolve([]),
    flags.canRevenue || flags.teacher
      ? db
          .select({
            name: bookings.subjectSlug,
            currencyCode: bookings.currencyCode,
            amount: sql<number>`sum(${bookings.amountMinor})`,
            value: count(),
          })
          .from(bookings)
          .where(openWhere(scope, eq(bookings.status, "completed")))
          .groupBy(bookings.subjectSlug, bookings.currencyCode)
          .orderBy(desc(sql`sum(${bookings.amountMinor})`))
          .limit(6)
      : Promise.resolve([]),
    flags.canRevenue || flags.teacher
      ? db
          .select({
            name: sql<string>`to_char(${bookings.startsAt}, 'YYYY-MM')`,
            currencyCode: bookings.currencyCode,
            amount: sql<number>`sum(${bookings.amountMinor})`,
            value: count(),
          })
          .from(bookings)
          .where(openWhere(scope, eq(bookings.status, "completed")))
          .groupBy(sql`to_char(${bookings.startsAt}, 'YYYY-MM')`, bookings.currencyCode)
          .orderBy(desc(sql`to_char(${bookings.startsAt}, 'YYYY-MM')`))
          .limit(6)
      : Promise.resolve([]),
  ]);

  const pipe = pipeline[0];
  const statuses = flags.canCrm
    ? {
        lead: num(pipe?.lead),
        registered: num(pipe?.registered),
        trialBooked: num(pipe?.trialBooked),
        trialCompleted: num(pipe?.trialCompleted),
        active: num(pipe?.active),
        inactive: num(pipe?.inactive),
        cancelled: num(pipe?.cancelled),
      }
    : null;
  const tickets = ticketCounts[0];
  const [liveSessions, recentSessions, sessionPeople] = sessionCounts;
  const retention = retentionRow[0];
  const trials = trialRow[0];
  const roleCount = (key: string) =>
    num(userRows.find((row) => row.key === key)?.value);
  const [newerUsers, activeUsers] = flags.canUsers
    ? await Promise.all([
        one(
          db
            .select({ value: count() })
            .from(users)
            .where(and(isNull(users.deletedAt), gte(users.createdAt, since30))),
        ),
        one(
          db
            .select({ value: count() })
            .from(users)
            .where(and(isNull(users.deletedAt), eq(users.status, "active"))),
        ),
      ])
    : [0, 0];
  const [followCounts] = flags.canCrm
    ? await db
        .select({
          due: sql<number>`count(*) filter (where ${crmNotes.followUpOn} >= now())`,
          overdue: sql<number>`count(*) filter (where ${crmNotes.followUpOn} < now())`,
        })
        .from(crmNotes)
        .where(isNotNull(crmNotes.followUpOn))
    : [{ due: 0, overdue: 0 }];
  const due = num(followCounts?.due);
  const overdue = num(followCounts?.overdue);
  const campaign = (status: string) =>
    num(campaignRows.find((row) => row.status === status)?.value);
  const financeCount = (kind: string) =>
    financeRows.filter((row) => row.kind === kind).reduce((sum, row) => sum + num(row.value), 0);
  const moneyRow = (
    prefix: string,
    row: { name: string; currencyCode: string; amount: unknown; value: unknown },
    index: number,
  ): Row => ({
    id: `${prefix}-${index}`,
    title: `${prefix} · ${row.name}`,
    meta: `${label(num(row.amount), row.currencyCode)} · ${num(row.value)}`,
  });
  const revenueRows: Row[] = [
    ...revenueTeachers.map((row, index) => moneyRow("Teacher", row, index)),
    ...revenueCourses.map((row, index) => moneyRow("Course", row, index)),
    ...revenueCountries.map((row, index) => moneyRow("Country", row, index)),
    ...revenueSubjects.map((row, index) => moneyRow("Subject", row, index)),
    ...revenueMonths.map((row, index) => moneyRow("Month", row, index)),
  ];
  const exportReports: CrmReport[] = [];
  if (flags.canCrm) exportReports.push("leads", "followups");
  exportReports.push("tickets", "sessions", "retention", "trials", "people");
  if (flags.canUsers) exportReports.push("users");
  if (showFinance) exportReports.push("financial");
  if (showAcademic) exportReports.push("academic");
  if (flags.canMarketing) exportReports.push("marketing");
  if (flags.canRevenue || flags.teacher) exportReports.push("revenue");

  const completed = num(retention?.completed);
  const cancelled = num(retention?.cancelled);
  const booked = num(trials?.booked);
  const trialCompleted = num(trials?.completed);
  const converted = num(trials?.converted);
  const teacherTotal = flags.parent || flags.student ? null : flags.teacher ? 1 : teachers;
  const teacherActive =
    flags.parent || flags.student ? null : flags.teacher ? (teacherKept > 0 ? 1 : 0) : teacherKept;

  return {
    staff: flags.staff,
    exportReports,
    overview: {
      leads: statuses ? Object.values(statuses).reduce((sum, value) => sum + value, 0) : null,
      tickets: num(tickets?.open),
      articles: help.articles + help.faqs + help.pages,
      exports: exportReports.length,
    },
    statuses,
    leads: {
      total: statuses ? Object.values(statuses).reduce((sum, value) => sum + value, 0) : null,
      rows: leadRows.map((row) => ({
        id: row.id,
        title: row.name,
        meta: `${row.status} · ${row.createdAt.toISOString().slice(0, 10)}`,
      })),
    },
    followUps: {
      due: flags.canCrm ? due : null,
      overdue: flags.canCrm ? overdue : null,
      rows: followUpRows.map((row) => ({
        id: row.id,
        title: row.name,
        meta: `${row.followUpOn?.toISOString().slice(0, 10) ?? ""} · ${row.body.slice(0, 80)}`,
      })),
    },
    help,
    tickets: {
      open: num(tickets?.open),
      mine: num(tickets?.mine),
      waiting: num(tickets?.waiting),
      closed: num(tickets?.closed),
      rows: ticketRows.map((row) => ({
        id: row.id,
        title: row.subject,
        meta: `${row.status} · ${row.category} · ${row.priority}`,
      })),
    },
    ticketFields: {
      categories: categoryRows.length,
      attachments: attachmentCount,
      unassigned: flags.canTickets ? num(tickets?.unassigned) : null,
          owners: flags.canTickets
            ? Math.max(0, num(tickets?.open) + num(tickets?.waiting) - num(tickets?.unassigned))
            : null,
      rows: categoryRows.map((row) => ({
        id: row.category,
        title: row.category,
        meta: String(num(row.value)),
      })),
    },
    users: flags.canUsers
      ? {
          total: userRows.reduce((sum, row) => sum + num(row.value), 0),
          active: activeUsers,
          newer: newerUsers,
          families: roleCount("parent") + roleCount("student"),
          teachers: roleCount("teacher"),
        }
      : null,
    sessions: {
      live: liveSessions,
      recent: recentSessions,
      people: sessionPeople,
      platform: flags.staff && flags.canUsers,
    },
    financial: showFinance
      ? {
          payments: financeCount("payment"),
          refunds: financeCount("refund"),
          holds: financeRows
            .filter((row) => row.status === "on_hold")
            .reduce((sum, row) => sum + num(row.value), 0),
          payouts: showPayouts ? financeCount("payout") : null,
          rows: financeRows
            .filter((row) => showPayouts || row.kind !== "payout")
            .map((row) => ({
              id: `${row.kind}-${row.status}-${row.currencyCode}`,
              title: `${row.kind} · ${row.status}`,
              meta: `${label(num(row.amount), row.currencyCode)} · ${num(row.value)}`,
            })),
        }
      : null,
    retention: {
      completed,
      cancelled,
      rate: rate(completed, completed + cancelled),
    },
    academic: showAcademic
      ? {
          homework: homeworkCount,
          exams: examCount,
          quizzes: quizCount,
          certificates: certificateCount,
        }
      : null,
    marketing: flags.canMarketing
      ? {
          live: campaign("active"),
          draft: campaign("draft") + campaign("scheduled") + campaign("paused"),
          ended: campaign("ended"),
        }
      : null,
    trials: {
      booked,
      completed: trialCompleted,
      converted,
      rate: rate(converted, booked),
    },
    people: {
      teachers: teacherTotal === null ? null : `${teacherActive} / ${teacherTotal}`,
      students: `${studentKept} / ${students}`,
    },
    revenue: flags.canRevenue || flags.teacher ? revenueRows : null,
  };
}

export async function parentChildIds(actor: ApiActor) {
  return actor.roleKey === "parent" ? childIdsFor(actor.userId) : [];
}
