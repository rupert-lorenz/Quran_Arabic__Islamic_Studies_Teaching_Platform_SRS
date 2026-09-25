import { StudentReportView } from "@/components/lms/student-report";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getStudentReportDesk } from "@/server/lms/reports";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Student reports",
};

export default async function StaffStudentReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireStaffPage([
    "academic.curriculum",
    "reports.academic",
  ]);
  const { student } = await searchParams;
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getStudentReportDesk(
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
        eyebrow={t("report.eyebrow")}
        title={t("report.title")}
        description={t("report.help")}
      />
      <StudentReportView
        desk={desk}
        backHref="/staff/academic"
        backLabel={t("report.back_staff")}
      />
    </Container>
  );
}
