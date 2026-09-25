import { BookingCalendar } from "@/components/bookings/booking-calendar";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getLessonCalendar } from "@/server/booking/calendar";
import { bookingWorkspace } from "@/server/booking/service";
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
  const [{ t }, state, calendar] = await Promise.all([
    getI18n(),
    bookingWorkspace(actor),
    getLessonCalendar(actor),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("learn.eyebrow")}
        title={t("booking.your_bookings")}
        description={t("booking.student_description")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
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
