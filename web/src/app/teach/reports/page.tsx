import { StudentReportView } from "@/components/lms/student-report";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getStudentReportDesk } from "@/server/lms/reports";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Student reports",
};

export default async function TeacherReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireApprovedTeacher();
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
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("report.eyebrow")}
        title={t("report.title")}
        description={t("report.help")}
      />
      <Container className="py-10">
        <StudentReportView
          desk={desk}
          backHref="/teach/home"
          backLabel={t("report.back_teach")}
        />
      </Container>
    </TeacherWorkspaceShell>
  );
}
