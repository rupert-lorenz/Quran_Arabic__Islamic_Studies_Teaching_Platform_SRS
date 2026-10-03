import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { userNotifications } from "@/db/schema";
import { COMMUNICATION_MODULES } from "@/lib/communications";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getIntegrationStatus } from "@/server/integrations/registry";

export async function getCommunicationsFaculty(actor: ApiActor) {
  const email = getIntegrationStatus().find((item) => item.key === "email");
  const staff = isStaffRole(actor.roleKey);
  const ownWhere = eq(userNotifications.userId, actor.userId);
  const [totalRow, unreadRow, recent] = await Promise.all([
    staff
      ? db.select({ value: count() }).from(userNotifications)
      : db
          .select({ value: count() })
          .from(userNotifications)
          .where(ownWhere),
    staff
      ? db
          .select({ value: count() })
          .from(userNotifications)
          .where(isNull(userNotifications.readAt))
      : db
          .select({ value: count() })
          .from(userNotifications)
          .where(
            and(ownWhere, isNull(userNotifications.readAt)),
          ),
    staff
      ? Promise.resolve([])
      : db
          .select({
            id: userNotifications.id,
            title: userNotifications.title,
            body: userNotifications.body,
            createdAt: userNotifications.createdAt,
            readAt: userNotifications.readAt,
          })
          .from(userNotifications)
          .where(ownWhere)
          .orderBy(desc(userNotifications.createdAt))
          .limit(8),
  ]);

  return {
    emailConfigured: Boolean(email?.configured),
    total: Number(totalRow[0]?.value ?? 0),
    unread: Number(unreadRow[0]?.value ?? 0),
    modules: COMMUNICATION_MODULES,
    recent: recent.map((row) => ({
      id: row.id,
      title: row.title,
      meta: `${row.readAt ? "read" : "unread"} · ${row.body} · ${row.createdAt.toISOString().slice(0, 10)}`,
    })),
  };
}
