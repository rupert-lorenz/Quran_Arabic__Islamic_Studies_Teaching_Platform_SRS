import { BookingCalendar } from "@/components/bookings/booking-calendar";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getLessonCalendar } from "@/server/booking/calendar";
import { bookingWorkspace } from "@/server/booking/service";
import { getI18n } from "@/server/i18n/locale";
import { requireParent } from "@/server/rbac/guard";
import Link from "next/link";

export const metadata = {
  title: "Family bookings",
};

export default async function FamilyBookingsPage() {
  const access = await requireParent();
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
        eyebrow={t("family.eyebrow")}
        title={t("booking.your_bookings")}
        description={t("booking.family_description")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/family" className="text-brand underline">
            {t("booking.back_family")}
          </Link>
          {" · "}
          <Link href="/teachers" className="text-brand underline">
            {t("nav.find_teachers")}
          </Link>
        </p>
        <BookingCalendar initial={state} calendar={calendar} role="parent" />
      </Container>
    </PublicShell>
  );
}
