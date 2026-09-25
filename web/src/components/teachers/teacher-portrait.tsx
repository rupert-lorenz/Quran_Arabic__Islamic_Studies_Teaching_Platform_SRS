export function TeacherPortrait({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter((part) => part !== "Ustadha" && part !== "Ustadh")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const sizes = {
    sm: "h-14 w-14 text-lg rounded-2xl",
    md: "h-16 w-16 text-xl rounded-2xl",
    lg: "h-24 w-24 text-3xl rounded-[1.5rem]",
    hero: "h-full min-h-48 w-full text-5xl rounded-[1.75rem]",
  };

  if (src) {
    return (
      // External teacher photos and YouTube thumbs are not in next/image remotePatterns.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-mint font-extrabold text-brand ${sizes[size]} ${className}`}
      aria-hidden="true"
    >
      {initials || "TP"}
    </div>
  );
}
