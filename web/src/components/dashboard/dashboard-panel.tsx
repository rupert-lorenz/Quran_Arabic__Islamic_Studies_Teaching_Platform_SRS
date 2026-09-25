import Link from "next/link";
import { StaffStat } from "@/components/staff/staff-stat";
import type { DashboardAction, DashboardStat } from "@/lib/dashboard";

export function DashboardStats({
  stats,
  title = "At a glance",
}: {
  stats: DashboardStat[];
  title?: string;
}) {
  if (!stats.length) {
    return null;
  }

  return (
    <section>
      <h2 className="sr-only">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StaffStat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
    </section>
  );
}

export function DashboardActions({
  actions,
  title = "Next steps",
}: {
  actions: DashboardAction[];
  title?: string;
}) {
  if (!actions.length) {
    return null;
  }

  return (
    <section>
      <h2 className="text-xl font-extrabold text-brand">{title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={`${action.href}-${action.label}`}
            href={action.href}
            className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
          >
            <h3 className="text-lg font-extrabold text-brand">{action.label}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{action.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function DashboardOverview({
  stats,
  actions,
  statsTitle,
  actionsTitle,
}: {
  stats: DashboardStat[];
  actions?: DashboardAction[];
  statsTitle?: string;
  actionsTitle?: string;
}) {
  return (
    <div className="space-y-6">
      <DashboardStats stats={stats} title={statsTitle} />
      {actions ? (
        <DashboardActions actions={actions} title={actionsTitle} />
      ) : null}
    </div>
  );
}
