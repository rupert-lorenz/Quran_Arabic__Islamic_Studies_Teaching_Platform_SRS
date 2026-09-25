import { TeacherBookingsWorkspace } from "@/components/teachers/teacher-bookings-workspace";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ClassroomRecordingLibrary } from "@/components/classroom/classroom-recording-library";
import { getTeacherCalendar } from "@/server/booking/calendar";
import { bookingWorkspace } from "@/server/booking/service";
import { listAccessibleRecordings } from "@/server/classroom/recording-access";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Bookings",
};

export default async function TeacherBookingsPage() {
  const access = await requireApprovedTeacher();
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [calendar, bookings, library] = await Promise.all([
    getTeacherCalendar(access.user.id),
    bookingWorkspace(actor),
    listAccessibleRecordings(actor),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow="Teach with us"
        title="Your lesson calendar"
        description="See booked lessons against your published hours. Cancel, reschedule, or mark attendance from the list below."
      />
      <Container className="py-10">
        <TeacherBookingsWorkspace calendar={calendar} bookings={bookings} />
        <div className="mt-8">
          <ClassroomRecordingLibrary
            recordings={library.recordings}
            retentionDays={library.retentionDays}
          />
        </div>
      </Container>
    </TeacherWorkspaceShell>
  );
}
