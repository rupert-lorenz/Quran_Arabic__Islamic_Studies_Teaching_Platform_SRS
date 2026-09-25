import { TeacherDashboard } from "@/components/teachers/teacher-dashboard";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getTeacherDashboard } from "@/server/dashboard";
import { getI18n } from "@/server/i18n/locale";
import { requireTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Teacher dashboard",
};

export default async function TeacherHomePage() {
  const access = await requireTeacher();
  const [dashboard, { t }] = await Promise.all([
    getTeacherDashboard(access.user.id),
    getI18n(),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("teach_dash.eyebrow")}
        title={t("teach_dash.hello", { name: access.user.displayName })}
        description={
          dashboard.approved
            ? t("teach_dash.approved")
            : t("teach_dash.pending")
        }
      />
      <Container className="py-10">
        <TeacherDashboard
          displayName={access.user.displayName}
          dashboard={dashboard}
        />
      </Container>
    </TeacherWorkspaceShell>
  );
}
