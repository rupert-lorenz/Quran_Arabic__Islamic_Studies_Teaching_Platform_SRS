import type { ReactNode } from "react";

export function workspacePillClass(active: boolean) {
  return `inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-full px-3 py-2 text-center text-sm font-bold leading-snug tracking-normal whitespace-normal sm:w-auto sm:min-w-fit ${
    active ? "bg-brand text-white" : "bg-surface text-brand"
  }`;
}

export function WorkspacePillNav({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap"
    >
      {children}
    </nav>
  );
}
