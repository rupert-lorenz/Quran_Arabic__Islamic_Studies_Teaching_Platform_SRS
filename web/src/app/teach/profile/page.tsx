import { TeacherProfileManager } from "@/components/teachers/teacher-profile-manager";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { requireApprovedTeacher } from "@/server/rbac/guard";
import { getManagedTeacherProfile } from "@/server/teacher/profile";

export const metadata = {
  title: "Teacher profile",
};

export default async function TeacherProfilePage() {
  const access = await requireApprovedTeacher();
  const state = await getManagedTeacherProfile(access.user.id);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow="Teach with us"
        title="Your teaching profile"
        description="Families see your headline, subjects, languages, and hourly rate. Keep this up to date after approval."
      />
      <Container className="py-10">
        <TeacherProfileManager initial={state} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
