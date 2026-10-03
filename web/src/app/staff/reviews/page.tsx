import { QualityFacultyView } from "@/components/finance/notice-faculties";
import { SafeguardFacultiesView } from "@/components/quality/safeguard-faculties";
import { StaffReviews } from "@/components/staff/staff-reviews";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { getQualityFaculty } from "@/server/finance/notice-faculties";
import { getSafeguardFaculties } from "@/server/quality/faculties";
import { requireStaffPage } from "@/server/rbac/guard";
import { listStaffTeacherReviews } from "@/server/reviews/service";

export const metadata = {
  title: "Reviews",
};

export default async function StaffReviewsPage() {
  const access = await requireStaffPage([
    "reviews.moderate",
    "teachers.approve",
  ]);
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [reviews, quality, safeguard] = await Promise.all([
    listStaffTeacherReviews(),
    getQualityFaculty(actor),
    getSafeguardFaculties(actor),
  ]);

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Teacher reviews</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Parent ratings stay hidden until staff publish them. Hidden reviews
        leave the public profile immediately.
      </p>
      <div className="mt-8">
        <QualityFacultyView quality={quality} staff />
        <div className="mt-8">
          <SafeguardFacultiesView faculties={safeguard} />
        </div>
      </div>
      <div className="mt-8">
        <StaffReviews
          initial={reviews}
          canModerate={hasAnyPermission(access, [
            "reviews.moderate",
            "teachers.approve",
          ])}
        />
      </div>
    </Container>
  );
}
