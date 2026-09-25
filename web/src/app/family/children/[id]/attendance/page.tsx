import { AttendanceDeskView } from "@/components/lms/attendance-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { isApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getAttendanceDesk } from "@/server/lms/attendance";
import { getManagedParentChild } from "@/server/parent/children";
import { requireParent } from "@/server/rbac/guard";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Attendance",
};

export default async function FamilyChildAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireParent();
  const { id } = await params;
  try {
    await getManagedParentChild(access.user.id, id);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getAttendanceDesk(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      { studentUserId: id },
    ),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("attendance.eyebrow")}
        title={t("attendance.title")}
        description={t("attendance.family_help")}
      />
      <Container className="py-10">
        <AttendanceDeskView desk={desk} />
      </Container>
    </PublicShell>
  );
}
