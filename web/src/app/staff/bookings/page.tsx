import { BookingCalendar } from "@/components/bookings/booking-calendar";
import { Container } from "@/components/ui/container";
import { getLessonCalendar } from "@/server/booking/calendar";
import { bookingWorkspace } from "@/server/booking/service";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Bookings",
};

export default async function StaffBookingsPage() {
  const access = await requireStaffPage(["classes.manage", "teachers.approve"]);
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [state, calendar] = await Promise.all([
    bookingWorkspace(actor),
    getLessonCalendar(actor),
  ]);

  return (
    <Container className="py-10">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-brand">
        Lesson calendar
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        One-to-one lessons across the marketplace this week, in your timezone.
        Open a lesson on the grid, then cancel, reschedule, or mark attendance
        from the list. Staff group-class postings are on Group classes.
      </p>
      <div className="mt-8">
        <BookingCalendar initial={state} calendar={calendar} role="staff" />
      </div>
    </Container>
  );
}
