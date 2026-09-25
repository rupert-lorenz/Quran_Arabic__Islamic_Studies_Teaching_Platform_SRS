import { AccountPermissionEditor } from "@/components/staff/account-permission-editor";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { isApiError } from "@/server/api/errors";
import { requireStaffPage } from "@/server/rbac/guard";
import { getUserPermissionState } from "@/server/rbac/user-permissions";
import { notFound } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Account permissions",
};

export default async function StaffUserPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireStaffPage("rbac.read");
  const { id } = await params;

  let state;
  try {
    state = await getUserPermissionState(id);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <Container className="py-10">
      <p className="text-sm font-semibold text-muted">
        <Link href="/staff/admins" className="underline">
          Admins
        </Link>
        {" · "}
        <Link href="/staff/users" className="underline">
          Users
        </Link>
        {" · "}
        <Link href="/staff/roles" className="underline">
          Role defaults
        </Link>
      </p>
      <h1 className="mt-3 text-3xl font-extrabold text-brand">
        Account permissions
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Role defaults apply to every account on that role. Custom mode applies
        only to this person.
      </p>
      <div className="mt-8">
        <AccountPermissionEditor
          initial={state}
          canWrite={
            hasAnyPermission(access, "rbac.write") && access.user.id !== id
          }
        />
      </div>
    </Container>
  );
}
