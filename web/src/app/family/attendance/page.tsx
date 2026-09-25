import { AttendanceDeskView } from "@/components/lms/attendance-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getAttendanceDesk } from "@/server/lms/attendance";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Attendance",
};

export default async function FamilyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireParent();
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
    <PublicShell>
      <PageHero
        eyebrow={t("attendance.eyebrow")}
        title={t("attendance.title")}
        description={t("attendance.family_help")}
      />
      <Container className="py-10">
        <AttendanceDeskView desk={desk} />
      </Container>
    </PublicShell>
  );
}
