import type { TeacherStats } from "@/lib/teacher-reputation";

export function TeacherStatsPanel({
  stats,
  compact = false,
}: {
  stats: TeacherStats;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid gap-2" : "grid gap-3"}>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-background px-3 py-3">
          <dt className="text-xs font-bold uppercase text-muted">Rating</dt>
          <dd className="font-extrabold text-brand">
            {stats.ratingLabel}
            {stats.reviewCount > 0 ? ` ★ · ${stats.reviewCount}` : ""}
          </dd>
        </div>
        <div className="rounded-2xl bg-background px-3 py-3">
          <dt className="text-xs font-bold uppercase text-muted">Lessons</dt>
          <dd className="font-extrabold text-brand">{stats.lessonsTaught}</dd>
        </div>
        {stats.responseRate != null ? (
          <div className="rounded-2xl bg-background px-3 py-3">
            <dt className="text-xs font-bold uppercase text-muted">
              Response rate
            </dt>
            <dd className="font-extrabold text-brand">{stats.responseRate}%</dd>
          </div>
        ) : null}
        {stats.recommendPercent != null && stats.reviewCount > 0 ? (
          <div className="rounded-2xl bg-background px-3 py-3">
            <dt className="text-xs font-bold uppercase text-muted">
              Would book again
            </dt>
            <dd className="font-extrabold text-brand">{stats.recommendPercent}%</dd>
          </div>
        ) : null}
      </dl>
      <div>
        <p className="text-sm font-extrabold text-brand">
          {stats.reliability.label}
        </p>
        {stats.reliability.indicators.length ? (
          <ul className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
            {stats.reliability.indicators.map((item) => (
              <li key={item} className="rounded-full bg-mint px-3 py-1 text-brand">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
