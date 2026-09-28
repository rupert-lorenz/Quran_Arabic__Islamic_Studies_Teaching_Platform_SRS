import type { ReactNode } from "react";

export const shortcutLinkClass =
  "h-auto w-full min-w-0 max-w-full shrink !whitespace-normal px-4 py-2.5 text-center leading-snug";

export function ShortcutLinkGrid({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={`grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 ${className}`}
    >
      {children}
    </nav>
  );
}
