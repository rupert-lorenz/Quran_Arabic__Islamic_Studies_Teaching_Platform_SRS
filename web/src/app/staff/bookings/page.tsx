import { BookingCalendar } from "@/components/bookings/booking-calendar";
import { BlockBookingsFacultyView } from "@/components/finance/block-bookings-faculty";
import { CoursePaymentsFacultyView } from "@/components/finance/course-payments-faculty";
import { GroupClassPaymentsFacultyView } from "@/components/finance/group-class-payments-faculty";
import { HourlyLessonsFacultyView } from "@/components/finance/hourly-lessons-faculty";
import { SinglePaymentsFacultyView } from "@/components/finance/single-payments-faculty";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getLessonCalendar } from "@/server/booking/calendar";
import { bookingWorkspace } from "@/server/booking/service";
import { getBlockBookingsFaculty } from "@/server/finance/block-bookings";
import { getCoursePaymentsFaculty } from "@/server/finance/course-payments";
import { getGroupClassPaymentsFaculty } from "@/server/finance/group-class-payments";
import { getHourlyLessonsFaculty } from "@/server/finance/hourly-lessons";
import { getSinglePaymentsFaculty } from "@/server/finance/single-payments";
import { getI18n } from "@/server/i18n/locale";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Hourly lessons",
};

export default async function StaffBookingsPage() {
  const access = await requireStaffPage(["classes.manage", "teachers.approve"]);
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [{ t }, state, calendar, hourly, single, blocks, coursePayments, groupPayments] = await Promise.all([
    getI18n(),
    bookingWorkspace(actor),
    getLessonCalendar(actor),
    getHourlyLessonsFaculty(actor),
    getSinglePaymentsFaculty(actor),
    getBlockBookingsFaculty(actor),
    getCoursePaymentsFaculty(actor),
    getGroupClassPaymentsFaculty(actor),
  ]);

  return (
    <>
      <PageHero
        eyebrow={t("hourly.faculty.eyebrow")}
        title={t("hourly.faculty.title")}
        description={t("hourly.faculty.page_help")}
      />
      <Container className="space-y-8 py-10">
        <HourlyLessonsFacultyView faculty={hourly} />
        <SinglePaymentsFacultyView faculty={single} />
        <BlockBookingsFacultyView faculty={blocks} />
        <CoursePaymentsFacultyView faculty={coursePayments} manageHref="/live-courses" />
        <GroupClassPaymentsFacultyView faculty={groupPayments} manageHref="/staff/group-classes" />
        <BookingCalendar initial={state} calendar={calendar} role="staff" />
      </Container>
    </>
  );
}
