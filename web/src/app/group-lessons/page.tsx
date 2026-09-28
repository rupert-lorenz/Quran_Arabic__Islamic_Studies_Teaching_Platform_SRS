import { GroupClassCatalogCard } from "@/components/bookings/group-class-catalog-card";
import { GroupClassPaymentsFacultyView } from "@/components/finance/group-class-payments-faculty";
import { MarketPriceNote } from "@/components/finance/location-price-faculty";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { isStaffRole } from "@/lib/rbac";
import { pageMetadata } from "@/server/cms/seo";
import { getGroupClassPaymentsFaculty } from "@/server/finance/group-class-payments";
import { getLocationPriceFaculty } from "@/server/finance/location-prices";
import { getI18n } from "@/server/i18n/locale";
import { getServerUser } from "@/server/auth/session";
import { listPublicGroupClassCatalog } from "@/server/booking/group-lessons";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("group.title"),
    description: t("group.description"),
    path: "/group-lessons",
  });
}

export default async function GroupLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ teacher?: string }>;
}) {
  const { teacher } = await searchParams;
  const user = await getServerUser();
  const actor = user
    ? { userId: user.id, roleKey: user.roleKey, permissions: [] }
    : null;
  const [{ t }, data, locationPrices, groupPayments] = await Promise.all([
    getI18n(),
    listPublicGroupClassCatalog(user?.id),
    getLocationPriceFaculty({ includeRules: false }),
    actor ? getGroupClassPaymentsFaculty(actor) : Promise.resolve(null),
  ]);
  const classes = teacher
    ? data.classes.filter((item) => item.teacherUserId === teacher)
    : data.classes;

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("group.eyebrow")}
        title={t("group.title")}
        description={t("group.catalog_description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: t("group.title") },
          ]}
        />
      </PageHero>
      <Container className="space-y-5 py-12">
        <MarketPriceNote faculty={locationPrices} />
        {groupPayments ? (
          <GroupClassPaymentsFacultyView
            faculty={groupPayments}
            manageHref={
              user?.roleKey === "teacher"
                ? "/teach/group-lessons"
                : user && isStaffRole(user.roleKey)
                  ? "/staff/group-classes"
                  : "/group-lessons"
            }
            hideStudentNames={user?.roleKey === "student"}
          />
        ) : null}
        {classes.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {classes.map((item) => (
              <GroupClassCatalogCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
            {t("group.empty")}
          </p>
        )}
      </Container>
    </PublicShell>
  );
}
