import { BrandMark } from "@/components/brand/brand-mark";
import type { BrandProfile } from "@/lib/brand";
import {
  overlayShowsBar,
  overlayShowsCorner,
  type ClassroomOverlay,
} from "@/lib/classroom-brand";

export function ClassroomOverlay({
  brand,
  overlay,
  placement,
}: {
  brand: BrandProfile;
  overlay: ClassroomOverlay;
  placement: "bar" | "corner";
}) {
  if (placement === "bar" && !overlayShowsBar(overlay)) return null;
  if (placement === "corner" && !overlayShowsCorner(overlay)) return null;
  if (
    !overlay.showMark &&
    !overlay.showName &&
    !overlay.showNameAr &&
    !overlay.showTagline
  ) {
    return null;
  }

  if (placement === "bar") {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-white"
        style={{ background: overlay.primaryColor }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {overlay.showMark ? <BrandMark size={28} tone="inverse" /> : null}
          {overlay.showMark ? null : (
            <div className="min-w-0 leading-tight">
              {overlay.showName ? (
                <p className="truncate text-xs font-extrabold">{brand.name}</p>
              ) : null}
              {overlay.showNameAr && brand.nameAr ? (
                <p className="truncate text-[0.65rem] text-white/70" dir="rtl">
                  {brand.nameAr}
                </p>
              ) : null}
            </div>
          )}
        </div>
        {overlay.showTagline ? (
          <p
            className="hidden text-[0.65rem] font-bold sm:block"
            style={{ color: overlay.accentColor }}
          >
            {brand.tagline}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute end-2 top-2 z-10 flex items-center gap-1.5 rounded-full px-2 py-1 text-white shadow-[var(--shadow-card)]"
      style={{ background: `${overlay.primaryColor}e6` }}
    >
      {overlay.showMark ? <BrandMark size={18} tone="inverse" /> : null}
      {overlay.showMark ? null : overlay.showName ? (
        <span className="text-[0.65rem] font-extrabold">{brand.shortName}</span>
      ) : null}
    </div>
  );
}
