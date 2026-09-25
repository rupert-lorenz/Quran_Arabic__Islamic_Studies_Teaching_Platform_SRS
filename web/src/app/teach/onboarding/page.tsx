import { TeacherOnboarding } from "@/components/teachers/teacher-onboarding";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { requireTeacherOnboarding } from "@/server/rbac/guard";
import { getOnboardingState } from "@/server/teacher/onboarding";

export const metadata = {
  title: "Teacher onboarding",
};

export default async function TeacherOnboardingPage() {
  const access = await requireTeacherOnboarding();
  const state = await getOnboardingState(access.user.id);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow="Teach with us"
        title="Complete your teacher application"
        description="Profile, documents, introduction video, and the platform agreement. Staff review comes after you submit."
      />
      <Container className="py-10">
        <TeacherOnboarding initial={state} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
