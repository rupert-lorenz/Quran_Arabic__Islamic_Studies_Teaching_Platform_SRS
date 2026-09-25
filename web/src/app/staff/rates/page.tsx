import { StaffRatesClient } from "@/components/staff/staff-rates-client";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { requireStaffPage } from "@/server/rbac/guard";
import { getTeacherRatePolicy } from "@/server/staff/rates";

export const metadata = {
  title: "Rates",
};

export default async function StaffRatesPage() {
  const access = await requireStaffPage([
    "settings.write",
    "teachers.approve",
    "payments.read",
  ]);
  const policy = await getTeacherRatePolicy();
  const canEdit = hasAnyPermission(access, [
    "settings.write",
    "teachers.approve",
  ]);

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Teacher rates</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Set the platform hourly range, then add country, subject, or
        teacher-specific controls. Listed prices must sit inside the effective
        band for that teacher.
      </p>
      <div className="mt-8">
        <StaffRatesClient initial={policy} canEdit={canEdit} />
      </div>
    </Container>
  );
}
