import { TeacherAvailabilityWorkspace } from "@/components/teachers/teacher-availability-workspace";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getTeacherCalendar } from "@/server/booking/calendar";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Availability",
};

export default async function TeacherAvailabilityPage() {
  const access = await requireApprovedTeacher();
  const calendar = await getTeacherCalendar(access.user.id);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow="Teach with us"
        title="Availability calendar"
        description="Set working hours, repeating breaks, holidays, and how much notice families must give before they can book."
      />
      <Container className="py-10">
        <TeacherAvailabilityWorkspace initial={calendar} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
