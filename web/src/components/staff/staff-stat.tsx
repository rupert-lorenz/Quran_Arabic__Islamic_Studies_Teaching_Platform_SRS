export function StaffStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <p className="text-xs font-bold uppercase tracking-[0.16em] break-words text-brand-soft">
        {label}
      </p>
      <p className="mt-2 break-words text-3xl font-extrabold text-brand">{value}</p>
    </div>
  );
}

export function StaffFlash({
  error,
  message,
}: {
  error: string;
  message: string;
}) {
  return (
    <>
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
    </>
  );
}
