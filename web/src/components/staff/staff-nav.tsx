"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n/i18n-provider";
import { hasAnyPermission, staffModules } from "@/lib/rbac";

export function StaffNav({
  permissions,
  roleKey,
}: {
  permissions: string[];
  roleKey: string;
}) {
  const t = useT();
  const pathname = usePathname();
  const actor = { roleKey, permissions };
  const items = staffModules.filter((item) =>
    hasAnyPermission(actor, item.permission),
  );

  return (
    <nav
      className="flex min-w-0 flex-wrap gap-2"
      aria-label={t("staff.nav")}
    >
      <Link
        href="/staff"
        className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold ${
          pathname === "/staff" ? "bg-brand text-white" : "bg-surface text-brand"
        }`}
      >
        {t("staff.dashboard")}
      </Link>
      <Link
        href="/staff/search"
        className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold ${
          pathname.startsWith("/staff/search")
            ? "bg-brand text-white"
            : "bg-surface text-brand"
        }`}
      >
        {t("staff.search")}
      </Link>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold ${
            pathname.startsWith(item.href)
              ? "bg-brand text-white"
              : "bg-surface text-brand"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
