import { TeacherVideoManager } from "@/components/teachers/teacher-video-manager";
import type { OnboardingState } from "@/components/teachers/teacher-onboarding";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { requireApprovedTeacher } from "@/server/rbac/guard";
import { getOnboardingState } from "@/server/teacher/onboarding";

export const metadata = {
  title: "Introduction video",
};

export default async function TeacherVideoPage() {
  const access = await requireApprovedTeacher();
  const state = (await getOnboardingState(access.user.id)) as OnboardingState;

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow="Teach with us"
        title="Your introduction video"
        description="Families see the last verified video. A replacement stays private until staff review it."
      />
      <Container className="py-10">
        <TeacherVideoManager initial={state} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
