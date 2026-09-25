import { StudentReportView } from "@/components/lms/student-report";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getStudentReportDesk } from "@/server/lms/reports";
import { requireStudent } from "@/server/rbac/guard";

export const metadata = {
  title: "Student report",
};

export default async function StudentReportsPage() {
  const access = await requireStudent();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getStudentReportDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("report.eyebrow")}
        title={t("report.title")}
        description={t("report.student_help")}
      />
      <Container className="py-10">
        <StudentReportView
          desk={desk}
          backHref="/learn"
          backLabel={t("library.back_learn")}
        />
      </Container>
    </PublicShell>
  );
}
