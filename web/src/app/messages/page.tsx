import { redirect } from "next/navigation";
import { SecureInbox } from "@/components/messages/secure-inbox";
import { PublicShell } from "@/components/layout/public-shell";
import { StaffNav } from "@/components/staff/staff-nav";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { isStaffRole } from "@/lib/rbac";
import { getI18n } from "@/server/i18n/locale";
import { getSecureInbox } from "@/server/messages/service";
import { getAccessContext } from "@/server/rbac/guard";

export const metadata = {
  title: "Messages",
};

export default async function MessagesPage() {
  const access = await getAccessContext();
  if (!access) {
    redirect("/login");
  }
  if (access.twoFactorPending) {
    redirect("/account/security");
  }
  const [{ t }, inbox] = await Promise.all([
    getI18n(),
    getSecureInbox({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);
  const staff = isStaffRole(access.user.roleKey);
  const teacher = access.user.roleKey === "teacher";
  const body = (
    <>
      <PageHero
        eyebrow={t("messages.eyebrow")}
        title={t("messages.title")}
        description={t("messages.help")}
      />
      <Container className="py-10">
        <SecureInbox initial={inbox} />
      </Container>
    </>
  );

  if (staff) {
    return (
      <PublicShell>
        <div className="logo-hang-band border-b border-line bg-mint/60">
          <Container className="pb-4">
            <StaffNav
              permissions={access.permissions}
              roleKey={access.user.roleKey}
            />
          </Container>
        </div>
        {body}
      </PublicShell>
    );
  }

  if (teacher) {
    return <TeacherWorkspaceShell>{body}</TeacherWorkspaceShell>;
  }

  return <PublicShell>{body}</PublicShell>;
}
