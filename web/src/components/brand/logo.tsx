import Link from "next/link";
import { defaultBrand, type BrandProfile } from "@/lib/brand";
import { BrandMark } from "./brand-mark";

export function Logo({
  compact = false,
  hang = false,
  tone = "default",
  brand = defaultBrand,
}: {
  compact?: boolean;
  hang?: boolean;
  tone?: "default" | "inverse";
  brand?: BrandProfile;
}) {
  const size = hang ? 96 : compact ? 36 : 48;

  return (
    <Link
      href="/"
      className={`flex items-center ${hang ? "relative z-50" : "min-h-12"}`}
      aria-label={`${brand.name} home`}
    >
      <BrandMark
        size={size}
        tone={tone}
        className={hang ? "h-[4.5rem] w-auto sm:h-24" : undefined}
      />
    </Link>
  );
}
