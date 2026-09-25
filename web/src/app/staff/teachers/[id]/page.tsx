import Link from "next/link";
import { notFound } from "next/navigation";
import { TeacherVerification } from "@/components/staff/teacher-applications";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { isApiError } from "@/server/api/errors";
import { requireStaffPage } from "@/server/rbac/guard";
import { getTeacherApplication } from "@/server/teacher/applications";

export const metadata = {
  title: "Teacher verification",
};

export default async function StaffTeacherVerificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireStaffPage([
    "teachers.approve",
    "teachers.documents.review",
  ]);
  const { id } = await params;

  let application;
  try {
    application = await getTeacherApplication(id);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <Container className="py-10">
      <p className="text-sm font-semibold text-muted">
        <Link href="/staff/teachers" className="underline">
          Teacher applications
        </Link>
      </p>
      <h1 className="mt-3 text-3xl font-extrabold text-brand">
        {application.displayName}
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Approve, reject, suspend, or restore this teacher after documents and
        the introduction video are verified. Rejected applications can be
        updated and submitted again. Suspension hides an approved teacher and
        blocks sign-in until you restore them.
      </p>
      <div className="mt-8">
        <TeacherVerification
          application={application}
          canReview={hasAnyPermission(access, "teachers.approve")}
          canSeeDocuments={hasAnyPermission(access, "teachers.documents.review")}
        />
      </div>
    </Container>
  );
}
