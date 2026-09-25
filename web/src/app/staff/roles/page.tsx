import { RoleMatrix } from "@/components/staff/role-matrix";
import { Container } from "@/components/ui/container";
import { dedicatedStaffRoles, hasAnyPermission } from "@/lib/rbac";
import { requireStaffPage } from "@/server/rbac/guard";
import { listRolesWithPermissions } from "@/server/rbac/permissions";
import Link from "next/link";

export const metadata = {
  title: "Roles",
};

export default async function StaffRolesPage() {
  const access = await requireStaffPage("rbac.read");
  const data = await listRolesWithPermissions();

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Roles & permissions</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Granular keys assigned to each role. Super Admin cannot be reduced.
        Per-account overrides live on{" "}
        <Link href="/staff/admins" className="underline">
          Admins
        </Link>
        .
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {dedicatedStaffRoles.map((role) => {
          const className =
            "rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]";
          const body = (
            <>
              <h2 className="text-lg font-extrabold text-brand">{role.label}</h2>
              <p className="mt-2 text-sm text-muted">{role.duties.join(" · ")}</p>
            </>
          );
          return hasAnyPermission(access, role.permission) ? (
            <Link key={role.key} href={role.href} className={className}>
              {body}
            </Link>
          ) : (
            <div key={role.key} className={className}>
              {body}
            </div>
          );
        })}
      </div>
      <div className="mt-8">
        <RoleMatrix
          catalog={data.catalog}
          roles={data.roles}
          canWrite={hasAnyPermission(access, "rbac.write")}
        />
      </div>
    </Container>
  );
}
