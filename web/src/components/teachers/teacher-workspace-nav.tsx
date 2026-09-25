"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n/i18n-provider";
import type { UiMessageKey } from "@/lib/i18n";

export function TeacherWorkspaceNav({
  approved,
  userId,
}: {
  approved: boolean;
  userId: string;
}) {
  const t = useT();
  const pathname = usePathname();
  const items: { href: string; labelKey: UiMessageKey; match?: "exact" | "prefix" }[] =
    approved
      ? [
          { href: "/teach/home", labelKey: "teach_nav.dashboard", match: "exact" },
          { href: "/teach/profile", labelKey: "teach_nav.profile" },
          { href: "/teach/availability", labelKey: "teach_nav.availability" },
          { href: "/teach/bookings", labelKey: "teach_nav.bookings" },
          { href: "/teach/group-lessons", labelKey: "teach_nav.group_lessons" },
          { href: "/teach/live-courses", labelKey: "teach_nav.live_courses" },
          { href: "/teach/library", labelKey: "teach_nav.library" },
          { href: "/teach/homework", labelKey: "teach_nav.homework" },
          { href: "/teach/games", labelKey: "teach_nav.games" },
          { href: "/teach/quizzes", labelKey: "teach_nav.quizzes" },
          { href: "/teach/exams", labelKey: "teach_nav.exams" },
          { href: "/teach/marking", labelKey: "teach_nav.marking" },
          { href: "/teach/reports", labelKey: "teach_nav.reports" },
          { href: "/teach/certificates", labelKey: "teach_nav.certificates" },
          { href: "/teach/rewards", labelKey: "teach_nav.rewards" },
          { href: "/teach/attendance", labelKey: "teach_nav.attendance" },
          { href: "/teach/activity", labelKey: "teach_nav.activity" },
          { href: "/teach/progress", labelKey: "teach_nav.progress" },
          { href: "/teach/quran", labelKey: "teach_nav.quran" },
          { href: "/teach/arabic", labelKey: "teach_nav.arabic" },
          { href: "/teach/islamic-studies", labelKey: "teach_nav.islamic" },
          { href: "/teach/ai", labelKey: "teach_nav.ai" },
          { href: "/teach/questions", labelKey: "teach_nav.questions" },
          { href: "/teach/video", labelKey: "teach_nav.video" },
          { href: "/teach/status", labelKey: "teach_nav.status" },
          { href: "/teach/agreement", labelKey: "teach_nav.agreement" },
          {
            href: `/teachers/${userId}`,
            labelKey: "teach_nav.public",
          },
          { href: "/account", labelKey: "teach_nav.account" },
        ]
      : [
          { href: "/teach/home", labelKey: "teach_nav.dashboard", match: "exact" },
          { href: "/teach/onboarding", labelKey: "teach_nav.application" },
          { href: "/teach/status", labelKey: "teach_nav.status" },
          { href: "/teach/agreement", labelKey: "teach_nav.agreement" },
          { href: "/account", labelKey: "teach_nav.account" },
        ];

  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={t("teach_nav.label")}
    >
      {items.map((item) => {
        const active =
          item.match === "exact"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold ${
              active ? "bg-brand text-white" : "bg-surface text-brand"
            }`}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
