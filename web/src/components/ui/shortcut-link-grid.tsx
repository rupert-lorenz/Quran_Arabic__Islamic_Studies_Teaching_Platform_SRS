import type { ReactNode } from "react";

export const shortcutLinkClass =
  "h-auto w-full min-w-0 shrink whitespace-normal px-4 py-2.5 text-center leading-snug";

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
      className={`grid min-w-0 grid-cols-1 gap-2 min-[22rem]:grid-cols-2 xl:grid-cols-3 ${className}`}
    >
      {children}
    </nav>
  );
}
