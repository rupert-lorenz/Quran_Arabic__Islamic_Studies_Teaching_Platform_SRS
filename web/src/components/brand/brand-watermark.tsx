import type { BrandProfile } from "@/lib/brand";
import { BrandMark } from "./brand-mark";

export function BrandWatermark({
  brand,
  placement = "corner",
}: {
  brand: BrandProfile;
  placement?: "corner" | "bar";
}) {
  if (placement === "bar") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand px-3 py-2 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark size={28} tone="inverse" />
        </div>
        <p className="hidden text-[0.65rem] font-bold text-brand-accent sm:block">
          {brand.tagline}
        </p>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute end-3 top-3 flex items-center gap-2 rounded-full bg-brand/90 px-2.5 py-1.5 text-white shadow-[var(--shadow-card)]">
      <BrandMark size={22} tone="inverse" />
    </div>
  );
}
