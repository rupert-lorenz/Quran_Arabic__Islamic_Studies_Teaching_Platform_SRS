"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n/i18n-provider";
import {
  WorkspacePillNav,
  workspacePillClass,
} from "@/components/ui/workspace-pill-nav";
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
    <WorkspacePillNav label={t("staff.nav")}>
      <Link
        href="/staff"
        className={workspacePillClass(pathname === "/staff")}
      >
        {t("staff.dashboard")}
      </Link>
      <Link
        href="/staff/search"
        className={workspacePillClass(pathname.startsWith("/staff/search"))}
      >
        {t("staff.search")}
      </Link>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={workspacePillClass(pathname.startsWith(item.href))}
        >
          {item.label}
        </Link>
      ))}
    </WorkspacePillNav>
  );
}
