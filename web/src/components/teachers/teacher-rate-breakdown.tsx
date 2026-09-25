import type { TeacherRateView } from "@/lib/teacher-rate-display";

export type { TeacherRateView };

export function TeacherRateBreakdown({
  rate,
  durationMinutes,
  compact = false,
  title,
  listedAs,
  revealInternalPayment = false,
}: {
  rate: TeacherRateView;
  durationMinutes?: number;
  compact?: boolean;
  title?: string;
  listedAs?: string;
  revealInternalPayment?: boolean;
}) {
  const showInternal =
    revealInternalPayment &&
    rate.teacherEarns != null &&
    rate.commissionAmount != null &&
    rate.commissionPercent != null;
  return (
    <div>
      {title ? (
        <p className="text-xs font-bold uppercase text-brand-soft">{title}</p>
      ) : null}
      <p className={compact ? "font-extrabold text-brand" : "text-2xl font-extrabold text-brand"}>
        {rate.formatted}
      </p>
      {rate.converted && rate.listedFormatted ? (
        <p className={compact ? "mt-1 text-xs font-semibold text-brand-soft" : "mt-1 text-sm font-semibold text-brand-soft"}>
          {listedAs ?? `Listed as ${rate.listedFormatted}`}
        </p>
      ) : null}
      {showInternal ? (
      <dl
        className={
          compact
            ? "mt-2 grid gap-1 text-xs"
            : "mt-3 grid gap-2 text-sm"
        }
      >
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Student pays</dt>
          <dd className="font-extrabold text-brand">{rate.studentPays}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            Platform commission ({rate.commissionPercent}%)
          </dt>
          <dd className="font-semibold text-brand">{rate.commissionAmount}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Teacher earns</dt>
          <dd className="font-extrabold text-brand">{rate.teacherEarns}</dd>
        </div>
      </dl>
      ) : null}
      {durationMinutes ? (
        <p className="mt-2 text-xs font-semibold text-brand-soft">
          Default lesson length is {durationMinutes} minutes. Prices are hourly.
        </p>
      ) : null}
    </div>
  );
}
