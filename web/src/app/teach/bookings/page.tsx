import { BlockBookingsFacultyView } from "@/components/finance/block-bookings-faculty";
import { HourlyLessonsFacultyView } from "@/components/finance/hourly-lessons-faculty";
import { SinglePaymentsFacultyView } from "@/components/finance/single-payments-faculty";
import { TeacherBookingsWorkspace } from "@/components/teachers/teacher-bookings-workspace";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ClassroomRecordingLibrary } from "@/components/classroom/classroom-recording-library";
import { getTeacherCalendar } from "@/server/booking/calendar";
import { bookingWorkspace } from "@/server/booking/service";
import { listAccessibleRecordings } from "@/server/classroom/recording-access";
import { getBlockBookingsFaculty } from "@/server/finance/block-bookings";
import { getHourlyLessonsFaculty } from "@/server/finance/hourly-lessons";
import { getSinglePaymentsFaculty } from "@/server/finance/single-payments";
import { getI18n } from "@/server/i18n/locale";
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
  const [{ t }, calendar, bookings, library, hourly, single, blocks] = await Promise.all([
    getI18n(),
    getTeacherCalendar(access.user.id),
    bookingWorkspace(actor),
    listAccessibleRecordings(actor),
    getHourlyLessonsFaculty(actor),
    getSinglePaymentsFaculty(actor),
    getBlockBookingsFaculty(actor),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("hourly.faculty.eyebrow")}
        title={t("hourly.faculty.title")}
        description={t("hourly.faculty.page_help")}
      />
      <Container className="space-y-8 py-10">
        <HourlyLessonsFacultyView faculty={hourly} />
        <SinglePaymentsFacultyView faculty={single} />
        <BlockBookingsFacultyView faculty={blocks} />
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
