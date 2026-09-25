import { StudentHome } from "@/components/students/student-home";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getStudentDashboard } from "@/server/dashboard";
import { getI18n } from "@/server/i18n/locale";
import { requireStudent } from "@/server/rbac/guard";

export const metadata = {
  title: "Student dashboard",
};

export default async function LearnPage() {
  const access = await requireStudent();
  const [dashboard, { t }] = await Promise.all([
    getStudentDashboard(access.user.id),
    getI18n(),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("learn.eyebrow")}
        title={t("learn.hello", { name: access.user.displayName })}
        description={t("learn.description")}
      />
      <Container className="py-10">
        <StudentHome
          displayName={access.user.displayName}
          profile={dashboard.profile}
          goals={dashboard.goals}
          history={dashboard.history}
          nextLesson={dashboard.nextLesson}
          stats={dashboard.stats}
          actions={dashboard.actions}
        />
      </Container>
    </PublicShell>
  );
}
