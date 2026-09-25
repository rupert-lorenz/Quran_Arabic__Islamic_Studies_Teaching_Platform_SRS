import { TeacherAgreementManager } from "@/components/teachers/teacher-agreement-manager";
import type { OnboardingState } from "@/components/teachers/teacher-onboarding";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { requireTeacher } from "@/server/rbac/guard";
import { getOnboardingState } from "@/server/teacher/onboarding";

export const metadata = {
  title: "Teacher agreement",
};

export default async function TeacherAgreementPage() {
  const access = await requireTeacher();
  const state = (await getOnboardingState(access.user.id)) as OnboardingState;

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow="Teach with us"
        title="Agreement and signature record"
        description="The version you signed is stored as an immutable digital record. If terms change, you sign the new version here."
      />
      <Container className="py-10">
        <TeacherAgreementManager initial={state} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
