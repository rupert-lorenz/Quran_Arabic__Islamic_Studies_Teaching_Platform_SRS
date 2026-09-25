import { eq } from "drizzle-orm";
import { AdminGroupClassCreator } from "@/components/bookings/admin-group-class-creator";
import { AdminGroupOpportunityBoard } from "@/components/bookings/admin-group-opportunity-board";
import { AdminGroupOpportunityForm } from "@/components/bookings/admin-group-opportunity-form";
import { Container } from "@/components/ui/container";
import { db } from "@/db";
import { currencies, subjects } from "@/db/schema";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import { listAdminGroupClassOpportunities } from "@/server/booking/group-class-opportunities";
import { listAdminGroupTeachingTeachers } from "@/server/booking/group-lessons";
import { getTeacherRateLimits } from "@/server/teacher/profile";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Group classes",
};

export default async function StaffGroupClassesPage() {
  const access = await requireStaffPage("classes.manage");
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [groupTeachers, rateLimits, enabledSubjects, enabledCurrencies, opportunities] =
    await Promise.all([
      listAdminGroupTeachingTeachers(actor),
      getTeacherRateLimits(),
      db
        .select({ slug: subjects.slug, name: subjects.name })
        .from(subjects)
        .where(eq(subjects.isEnabled, true))
        .orderBy(subjects.sortOrder),
      db
        .select({ code: currencies.code, symbol: currencies.symbol })
        .from(currencies)
        .where(eq(currencies.isEnabled, true))
        .orderBy(currencies.code),
      listAdminGroupClassOpportunities(actor),
    ]);

  return (
    <Container className="space-y-8 py-10">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-brand">
          Group classes
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Post a class that still needs a teacher, choose among applicants, or
          create a schedule for an opted-in teacher. Families never see
          opportunities or teacher payment. Teachers can also publish their own
          classes without a staff posting.
        </p>
      </div>
      <AdminGroupOpportunityForm
        subjects={enabledSubjects}
        currencies={enabledCurrencies}
        defaultCurrency={
          enabledCurrencies.find((item) => item.code === DEFAULT_CURRENCY)
            ?.code ??
          enabledCurrencies[0]?.code ??
          DEFAULT_CURRENCY
        }
      />
      <AdminGroupOpportunityBoard initial={opportunities} />
      <AdminGroupClassCreator
        teachers={groupTeachers}
        commissionPercent={rateLimits.commissionPercent}
      />
    </Container>
  );
}
