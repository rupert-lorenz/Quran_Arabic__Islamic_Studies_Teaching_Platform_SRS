import { TeacherVerificationStatus } from "@/components/teachers/teacher-verification-status";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { requireTeacher } from "@/server/rbac/guard";
import { getTeacherVerificationSummary } from "@/server/teacher/onboarding";

export const metadata = {
  title: "Verification status",
};

export default async function TeacherVerificationStatusPage() {
  const access = await requireTeacher();
  const summary = await getTeacherVerificationSummary(access.user.id);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow="Teach with us"
        title="Your verification status"
        description="See what staff have verified and what still needs to happen before families can book you."
      />
      <Container className="py-10">
        <TeacherVerificationStatus summary={summary} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
