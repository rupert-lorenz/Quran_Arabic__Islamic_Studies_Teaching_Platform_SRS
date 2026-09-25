import { PublicShell } from "@/components/layout/public-shell";
import { TeacherWorkspaceNav } from "@/components/teachers/teacher-workspace-nav";
import { Container } from "@/components/ui/container";
import { getAccessContext } from "@/server/rbac/guard";

export async function TeacherWorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAccessContext();
  const isTeacher = access?.user.roleKey === "teacher";
  const approved = Boolean(isTeacher && !access?.teacherOnboardingRequired);

  return (
    <PublicShell>
      {isTeacher && access ? (
        <div className="logo-hang-band border-b border-line bg-mint/50">
          <Container className="pb-3">
            <TeacherWorkspaceNav approved={approved} userId={access.user.id} />
          </Container>
        </div>
      ) : null}
      {children}
    </PublicShell>
  );
}
