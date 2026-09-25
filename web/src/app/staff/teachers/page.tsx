import { TeacherAgreementPublisher } from "@/components/staff/teacher-agreement-publisher";
import { TeacherApplications } from "@/components/staff/teacher-applications";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { requireStaffPage } from "@/server/rbac/guard";
import { ensureCurrentAgreementVersion } from "@/server/teacher/agreement";
import { listTeacherApplications } from "@/server/teacher/applications";

export const metadata = {
  title: "Teachers",
};

export default async function StaffTeachersPage() {
  const access = await requireStaffPage([
    "teachers.approve",
    "teachers.documents.review",
  ]);
  const [applications, currentAgreement] = await Promise.all([
    listTeacherApplications(),
    ensureCurrentAgreementVersion(),
  ]);
  const canReview = hasAnyPermission(access, "teachers.approve");

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Teacher applications</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Filter by status, then approve, reject, suspend, or restore. Approval
        stays blocked until identity, qualification, and the introduction video
        pass. Rejected teachers can sign in and submit again; suspended teachers
        cannot sign in or appear to families.
      </p>
      <div className="mt-8">
        <TeacherAgreementPublisher
          initial={currentAgreement}
          canPublish={canReview}
        />
        <TeacherApplications
          applications={applications}
          canReview={canReview}
          canSeeDocuments={hasAnyPermission(access, "teachers.documents.review")}
        />
      </div>
    </Container>
  );
}
