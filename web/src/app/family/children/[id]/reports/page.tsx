import { StudentReportView } from "@/components/lms/student-report";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { isApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getStudentReportDesk } from "@/server/lms/reports";
import { getManagedParentChild } from "@/server/parent/children";
import { requireParent } from "@/server/rbac/guard";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Student report",
};

export default async function FamilyChildReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireParent();
  const { id } = await params;
  try {
    await getManagedParentChild(access.user.id, id);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getStudentReportDesk(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      { studentUserId: id },
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
          backHref={`/family/children/${id}`}
          backLabel={t("report.back_child")}
        />
      </Container>
    </PublicShell>
  );
}
