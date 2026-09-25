import { AdminAccountsPanel } from "@/components/staff/admin-accounts-panel";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { requireStaffPage } from "@/server/rbac/guard";
import { listAdminAccounts } from "@/server/rbac/user-permissions";
import Link from "next/link";

export const metadata = {
  title: "Admins",
};

export default async function StaffAdminsPage() {
  const access = await requireStaffPage("rbac.write");
  const admins = await listAdminAccounts();

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Admin accounts</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Super Admin can give each Admin a custom permission set, or leave them
        on the shared{" "}
        <Link href="/staff/roles" className="underline">
          Admin role defaults
        </Link>
        .
      </p>
      <div className="mt-8">
        <AdminAccountsPanel
          admins={admins}
          canCreate={hasAnyPermission(access, "users.write")}
        />
      </div>
    </Container>
  );
}
