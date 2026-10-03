import { redirect } from "next/navigation";
import { TwoFactorSettings } from "@/components/account/two-factor-settings";
import { PublicShell } from "@/components/layout/public-shell";
import { DocumentDesk } from "@/components/infrastructure/document-desk";
import { InfrastructureFacultiesView } from "@/components/infrastructure/infrastructure-faculties";
import { PrivacyControls } from "@/components/security/privacy-controls";
import { SecurityFacultiesView } from "@/components/security/security-faculties";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getTwoFactorStatus } from "@/server/auth/two-factor";
import { getI18n } from "@/server/i18n/locale";
import { getAccessContext } from "@/server/rbac/guard";
import { documentSubjects, listStudentDocuments } from "@/server/infrastructure/documents";
import { getInfrastructureFaculties } from "@/server/infrastructure/faculties";
import { getSecurityFaculties } from "@/server/security/faculties";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("sp.page.title"), description: t("sp.page.help") };
}

export default async function AccountSecurityPage() {
  const [{ t }, access] = await Promise.all([getI18n(), getAccessContext()]);
  if (!access) redirect("/login");

  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [status, faculties, infrastructure, documents, students] = await Promise.all([
    getTwoFactorStatus(access.user),
    getSecurityFaculties(actor),
    getInfrastructureFaculties(actor),
    listStudentDocuments(actor),
    documentSubjects(actor),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("sp.page.title")}
        title={t("sp.page.title")}
        description={t("sp.page.help")}
      />
      <Container className="space-y-8 py-10">
        <section className="max-w-xl rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            {t("sp.twoFactor.title")}
          </h2>
          <div className="mt-4">
            <TwoFactorSettings {...status} />
          </div>
        </section>
        <PrivacyControls faculties={faculties} />
        <DocumentDesk
          documents={documents}
          students={students}
          chooseStudent={
            isStaffRole(access.user.roleKey) &&
            hasAnyPermission(actor, [
              "users.read",
              "safeguarding.incidents",
              "teachers.documents.review",
            ])
          }
          canStore={
            access.user.roleKey === "student" ||
            access.user.roleKey === "parent" ||
            (isStaffRole(access.user.roleKey) &&
              hasAnyPermission(actor, [
                "users.read",
                "safeguarding.incidents",
                "teachers.documents.review",
              ]))
          }
        />
        <SecurityFacultiesView faculties={faculties} />
        <InfrastructureFacultiesView faculties={infrastructure} />
      </Container>
    </PublicShell>
  );
}
