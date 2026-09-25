import { StudentReportView } from "@/components/lms/student-report";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getStudentReportDesk } from "@/server/lms/reports";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Student reports",
};

export default async function FamilyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireParent();
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
    <PublicShell>
      <PageHero
        eyebrow={t("report.eyebrow")}
        title={t("report.title")}
        description={t("report.family_help")}
      />
      <Container className="py-10">
        <StudentReportView
          desk={desk}
          backHref="/family"
          backLabel={t("library.back_family")}
        />
      </Container>
    </PublicShell>
  );
}
