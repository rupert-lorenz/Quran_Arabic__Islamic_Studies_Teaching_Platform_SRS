export const BRAND_LOGO_SRC = "/brand/logo.png";
export const BRAND_LOGO_WIDTH = 253;
export const BRAND_LOGO_HEIGHT = 96;

type BrandMarkProps = {
  size?: number;
  tone?: "default" | "inverse";
  className?: string;
};

export function BrandMark({
  size = 40,
  className,
}: BrandMarkProps) {
  const width = Math.round((size * BRAND_LOGO_WIDTH) / BRAND_LOGO_HEIGHT);

  return (
    // Wordmark PNG is sized dynamically; next/image aspect locking fights header/footer heights.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND_LOGO_SRC}
      alt=""
      width={width}
      height={size}
      role="presentation"
      aria-hidden
      className={`object-contain object-left ${className ?? ""}`}
      style={className?.includes("h-") ? { width: "auto" } : undefined}
    />
  );
}
