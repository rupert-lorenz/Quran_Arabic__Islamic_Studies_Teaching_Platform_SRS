import { StaffUserDirectory } from "@/components/staff/staff-user-directory";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { requireStaffPage } from "@/server/rbac/guard";
import {
  countActiveSuperAdmins,
  listDirectory,
} from "@/server/staff/accounts";

export const metadata = {
  title: "Users",
};

export default async function StaffUsersPage() {
  const access = await requireStaffPage("users.read");
  const [users, superAdminCount] = await Promise.all([
    listDirectory(),
    countActiveSuperAdmins(),
  ]);

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Users</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Create Accounts, Marketing, Academic, or Safeguarding staff for their
        dedicated workspaces. Use Permissions to give an account its own set, or
        leave it on the role defaults.
      </p>
      <div className="mt-8">
        <StaffUserDirectory
          users={users}
          actorUserId={access.user.id}
          actorRoleKey={access.user.roleKey}
          canWrite={hasAnyPermission(access, "users.write")}
          canSuspend={hasAnyPermission(access, "users.suspend")}
          canConfigurePermissions={hasAnyPermission(access, "rbac.write")}
          superAdminCount={superAdminCount}
        />
      </div>
    </Container>
  );
}
