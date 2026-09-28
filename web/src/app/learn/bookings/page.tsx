import { BookingCalendar } from "@/components/bookings/booking-calendar";
import { BlockBookingsFacultyView } from "@/components/finance/block-bookings-faculty";
import { CoursePaymentsFacultyView } from "@/components/finance/course-payments-faculty";
import { GroupClassPaymentsFacultyView } from "@/components/finance/group-class-payments-faculty";
import { HourlyLessonsFacultyView } from "@/components/finance/hourly-lessons-faculty";
import { SinglePaymentsFacultyView } from "@/components/finance/single-payments-faculty";
import { PublicShell } from "@/components/layout/public-shell";
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
import { requireStudent } from "@/server/rbac/guard";
import Link from "next/link";

export const metadata = {
  title: "Your bookings",
};

export default async function StudentBookingsPage() {
  const access = await requireStudent();
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
    <PublicShell>
      <PageHero
        eyebrow={t("learn.eyebrow")}
        title={t("booking.your_bookings")}
        description={t("booking.student_description")}
      />
      <Container className="space-y-8 py-10">
        <HourlyLessonsFacultyView faculty={hourly} hideStudentNames />
        <SinglePaymentsFacultyView faculty={single} hideStudentNames />
        <BlockBookingsFacultyView faculty={blocks} hideStudentNames />
        <CoursePaymentsFacultyView
          faculty={coursePayments}
          manageHref="/live-courses"
          hideStudentNames
        />
        <GroupClassPaymentsFacultyView
          faculty={groupPayments}
          manageHref="/group-lessons"
          hideStudentNames
        />
        <p className="text-sm font-semibold">
          <Link href="/learn" className="text-brand underline">
            {t("booking.back_learn")}
          </Link>
          {" · "}
          <Link href="/teachers" className="text-brand underline">
            {t("nav.find_teachers")}
          </Link>
        </p>
        <BookingCalendar initial={state} calendar={calendar} role="student" />
      </Container>
    </PublicShell>
  );
}
