export type DashboardAction = {
  href: string;
  label: string;
  detail: string;
};

export type DashboardStat = {
  label: string;
  value: string | number;
};

export function staffDashboardTitle(roleKey: string) {
  return roleKey === "admin" || roleKey === "super_admin"
    ? "Admin dashboard"
    : "Staff dashboard";
}
