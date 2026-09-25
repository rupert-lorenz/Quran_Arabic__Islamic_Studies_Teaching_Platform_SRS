import { StaffReviews } from "@/components/staff/staff-reviews";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
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
  const reviews = await listStaffTeacherReviews();

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Teacher reviews</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Parent ratings stay hidden until staff publish them. Hidden reviews
        leave the public profile immediately.
      </p>
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
