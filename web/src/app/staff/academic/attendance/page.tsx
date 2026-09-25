import { AttendanceDeskView } from "@/components/lms/attendance-desk";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getAttendanceDesk } from "@/server/lms/attendance";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Attendance",
};

export default async function StaffAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireStaffPage([
    "academic.curriculum",
    "academic.certificates",
    "reports.academic",
    "classes.manage",
  ]);
  const { student } = await searchParams;
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getAttendanceDesk(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      { studentUserId: student },
    ),
  ]);

  return (
    <Container className="py-10">
      <PageHero
        eyebrow={t("attendance.eyebrow")}
        title={t("attendance.title")}
        description={t("attendance.help")}
      />
      <AttendanceDeskView desk={desk} />
    </Container>
  );
}
