import { TeachingMaterialLibrary } from "@/components/lms/teaching-material-library";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listTeachingLibrary } from "@/server/lms/library";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Teaching library",
};

export default async function TeacherLibraryPage() {
  const access = await requireApprovedTeacher();
  const [{ t }, library] = await Promise.all([
    getI18n(),
    listTeachingLibrary({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("library.eyebrow")}
        title={t("library.title")}
        description={t("library.teacher_help")}
      />
      <Container className="py-10">
        <TeachingMaterialLibrary
          materials={library.materials}
          subjects={library.subjects}
          catalog={library.catalog}
          licences={library.licences}
          rentals={library.rentals}
          subscriptions={library.subscriptions}
          purchases={library.purchases}
          courses={library.courses}
          canUpload={library.canUpload}
          canManage={library.canManage}
        />
      </Container>
    </TeacherWorkspaceShell>
  );
}
