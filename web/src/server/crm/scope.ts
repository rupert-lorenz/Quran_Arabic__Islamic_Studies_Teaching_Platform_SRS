import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bookings, parentChildren, users } from "@/db/schema";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";

export function crmFlags(actor: ApiActor) {
  const staff = isStaffRole(actor.roleKey);
  return {
    staff,
    teacher: actor.roleKey === "teacher",
    parent: actor.roleKey === "parent",
    student: actor.roleKey === "student",
    canCrm: hasAnyPermission(actor, "crm.manage"),
    canTickets: hasAnyPermission(actor, "support.tickets"),
    canUsers: hasAnyPermission(actor, "users.read"),
    canFinance: hasAnyPermission(actor, ["payments.read", "reports.finance"]),
    canMarketing: hasAnyPermission(actor, ["marketing.campaigns", "reports.marketing"]),
    canAcademic: hasAnyPermission(actor, [
      "academic.curriculum",
      "reports.academic",
      "classes.manage",
    ]),
    canRevenue: hasAnyPermission(actor, ["payments.read", "reports.finance"]),
  };
}

export async function childIdsFor(parentUserId: string) {
  const rows = await db
    .select({ id: parentChildren.childUserId })
    .from(parentChildren)
    .where(eq(parentChildren.parentUserId, parentUserId));
  return rows.map((row) => row.id);
}

export async function bookingScope(actor: ApiActor): Promise<SQL | undefined> {
  const flags = crmFlags(actor);
  if (flags.staff) return undefined;
  if (flags.teacher) return eq(bookings.teacherUserId, actor.userId);
  if (flags.parent) {
    const childIds = await childIdsFor(actor.userId);
    return or(
      eq(bookings.bookedByUserId, actor.userId),
      childIds.length ? inArray(bookings.studentUserId, childIds) : sql`false`,
    );
  }
  if (flags.student) return eq(bookings.studentUserId, actor.userId);
  return sql`false`;
}

export async function learnerIds(actor: ApiActor) {
  const flags = crmFlags(actor);
  if (flags.staff) return null;
  if (flags.student) return [actor.userId];
  if (flags.parent) return childIdsFor(actor.userId);
  return null;
}

export function openWhere(scope: SQL | undefined, extra?: SQL) {
  if (scope && extra) return and(scope, extra);
  return scope ?? extra ?? sql`true`;
}

export const liveUser = isNull(users.deletedAt);
