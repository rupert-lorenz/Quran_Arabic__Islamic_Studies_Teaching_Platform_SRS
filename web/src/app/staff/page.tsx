import { DashboardOverview } from "@/components/dashboard/dashboard-panel";
import { Container } from "@/components/ui/container";
import { staffDashboardTitle } from "@/lib/dashboard";
import { dedicatedStaffRoles, hasAnyPermission, staffModules } from "@/lib/rbac";
import { getStaffDashboard } from "@/server/dashboard";
import { trainingPath } from "@/server/docs/training";
import { getI18n } from "@/server/i18n/locale";
import { requireStaffPage } from "@/server/rbac/guard";
import Link from "next/link";

export const metadata = {
  title: "Staff dashboard",
};

export default async function StaffHomePage() {
  const access = await requireStaffPage();
  const [{ t }, dashboard] = await Promise.all([
    getI18n(),
    getStaffDashboard(access),
  ]);
  const modules = staffModules.filter((item) =>
    hasAnyPermission(access, item.permission),
  );
  const title = staffDashboardTitle(access.user.roleKey);

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Live counts for the areas granted to the{" "}
        <strong>{access.user.roleKey.replaceAll("_", " ")}</strong> role.
      </p>
      <p className="mt-4 text-sm">
        <Link href={trainingPath(access.user.roleKey)} className="font-bold text-brand-accent underline">
          {t("tr.open.yours")}
        </Link>
      </p>
      {access.user.roleKey === "super_admin" ? (
        <p className="mt-6 rounded-[2rem] bg-mint px-5 py-4 font-semibold text-brand">
          Super Admin controls: create staff on{" "}
          <Link href="/staff/users" className="underline">
            Users
          </Link>
          , tailor each Admin on{" "}
          <Link href="/staff/admins" className="underline">
            Admins
          </Link>
          , and change shared role defaults on{" "}
          <Link href="/staff/roles" className="underline">
            Roles
          </Link>
          . Create Accounts, Marketing, Academic, and Safeguarding staff on Users
          for dedicated workspaces. The last Super Admin cannot be suspended or
          demoted.
        </p>
      ) : null}
      {dedicatedStaffRoles
        .filter((role) => role.key === access.user.roleKey)
        .map((role) => (
          <p
            key={role.key}
            className="mt-6 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand"
          >
            Your {role.label} role can: {role.duties.join(", ")}. Open{" "}
            <Link href={role.href} className="underline">
              {role.label}
            </Link>
            .
          </p>
        ))}
      <div className="mt-8">
        <DashboardOverview
          stats={dashboard.stats}
          actions={dashboard.actions}
          actionsTitle="Needs attention"
        />
      </div>
      {modules.length === 0 ? (
        <p className="mt-8 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
          This staff role has no module permissions yet.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
            >
              <h2 className="text-xl font-extrabold text-brand">{item.label}</h2>
              <p className="mt-2 text-sm text-muted">{item.description}</p>
              <p className="mt-4 text-xs font-bold text-brand-soft">
                {Array.isArray(item.permission)
                  ? item.permission.join(" · ")
                  : item.permission}
              </p>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
