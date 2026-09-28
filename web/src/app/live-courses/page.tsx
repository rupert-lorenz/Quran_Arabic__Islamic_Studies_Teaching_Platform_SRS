import { LiveCourseCard } from "@/components/bookings/live-course-card";
import { CoursePaymentsFacultyView } from "@/components/finance/course-payments-faculty";
import { MarketPriceNote } from "@/components/finance/location-price-faculty";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getServerUser } from "@/server/auth/session";
import { bookingViewerForTeacherPage } from "@/server/booking/service";
import { listPublicLiveCourses } from "@/server/booking/live-courses";
import { pageMetadata } from "@/server/cms/seo";
import { getCoursePaymentsFaculty } from "@/server/finance/course-payments";
import { getLocationPriceFaculty } from "@/server/finance/location-prices";
import { getI18n } from "@/server/i18n/locale";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("live.title"),
    description: t("live.description"),
    path: "/live-courses",
  });
}

export default async function LiveCoursesPage() {
  const user = await getServerUser();
  const actor = user
    ? { userId: user.id, roleKey: user.roleKey, permissions: [] }
    : null;
  const [{ t }, data, viewer, locationPrices, coursePayments] = await Promise.all([
    getI18n(),
    listPublicLiveCourses(user?.id),
    bookingViewerForTeacherPage(
      user ? { id: user.id, roleKey: user.roleKey } : null,
    ),
    getLocationPriceFaculty({ includeRules: false }),
    actor ? getCoursePaymentsFaculty(actor) : Promise.resolve(null),
  ]);
  return (
    <PublicShell>
      <PageHero
        eyebrow={t("live.eyebrow")}
        title={t("live.title")}
        description={t("live.description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: t("live.title") },
          ]}
        />
      </PageHero>
      <Container className="space-y-5 py-12">
        <MarketPriceNote faculty={locationPrices} />
        {coursePayments ? (
          <CoursePaymentsFacultyView
            faculty={coursePayments}
            manageHref={user?.roleKey === "teacher" ? "/teach/live-courses" : "/live-courses"}
            hideStudentNames={user?.roleKey === "student"}
          />
        ) : null}
        {data.courses.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.courses.map((course) => (
              <LiveCourseCard key={course.id} course={course} viewer={viewer} />
            ))}
          </div>
        ) : (
          <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
            {t("live.empty")}
          </p>
        )}
      </Container>
    </PublicShell>
  );
}
