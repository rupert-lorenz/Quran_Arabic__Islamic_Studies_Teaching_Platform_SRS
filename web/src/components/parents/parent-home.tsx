import Link from "next/link";
import { DashboardOverview } from "@/components/dashboard/dashboard-panel";
import { ButtonLink } from "@/components/ui/button";
import {
  ShortcutLinkGrid,
  shortcutLinkClass,
} from "@/components/ui/shortcut-link-grid";
import type { DashboardAction, DashboardStat } from "@/lib/dashboard";
import { MAX_CHILDREN_PER_PARENT } from "@/lib/parent-profile";
import { getI18n } from "@/server/i18n/locale";
import type { getManagedParentProfile } from "@/server/parent/profile";
import { UpcomingLessonCard } from "@/components/bookings/upcoming-lesson-card";
import type { BookingView } from "@/lib/booking";

type ParentProfileState = Awaited<ReturnType<typeof getManagedParentProfile>>;

export async function ParentHome({
  displayName,
  profile,
  stats,
  actions,
  nextLesson,
}: {
  displayName: string;
  profile: ParentProfileState;
  stats: DashboardStat[];
  actions: DashboardAction[];
  nextLesson: BookingView | null;
}) {
  const { t } = await getI18n();
  const { completeness, children } = profile;
  const canAddChild = children.length < MAX_CHILDREN_PER_PARENT;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="lg:col-span-2">
        <DashboardOverview stats={stats} actions={actions} />
      </div>
      <UpcomingLessonCard lesson={nextLesson} href="/family/bookings" />
      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">{t("family.profile")}</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("common.name")}</dt>
            <dd className="font-bold text-brand">{displayName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("family.role")}</dt>
            <dd className="font-bold text-brand">
              {profile.profile.relationshipLabel ?? t("family.add_relationship")}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("common.country")}</dt>
            <dd className="font-bold text-brand">
              {profile.profile.countryName ?? t("learn.add_country")}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("family.phone")}</dt>
            <dd className="font-bold text-brand">
              {profile.profile.phone || t("family.not_listed")}
            </dd>
          </div>
        </dl>
        {profile.profile.about ? (
          <p className="mt-4 text-sm leading-6 text-muted">{profile.profile.about}</p>
        ) : null}
        <ShortcutLinkGrid label={t("family.edit")} className="mt-6">
          <ButtonLink href="/family/profile" className={shortcutLinkClass}>
            {t("family.edit")}
          </ButtonLink>
          <ButtonLink href="/family/bookings" variant="secondary" className={shortcutLinkClass}>
            {t("booking.your_bookings")}
          </ButtonLink>
          <ButtonLink href="/family/library" variant="secondary" className={shortcutLinkClass}>
            {t("library.title")}
          </ButtonLink>
          <ButtonLink href="/family/homework" variant="secondary" className={shortcutLinkClass}>
            {t("homework.title")}
          </ButtonLink>
          <ButtonLink href="/family/games" variant="secondary" className={shortcutLinkClass}>
            {t("games.title")}
          </ButtonLink>
          <ButtonLink href="/family/quizzes" variant="secondary" className={shortcutLinkClass}>
            {t("quiz.title")}
          </ButtonLink>
          <ButtonLink href="/family/exams" variant="secondary" className={shortcutLinkClass}>
            {t("exam.title")}
          </ButtonLink>
          <ButtonLink href="/family/reports" variant="secondary" className={shortcutLinkClass}>
            {t("report.title")}
          </ButtonLink>
          <ButtonLink href="/family/certificates" variant="secondary" className={shortcutLinkClass}>
            {t("cert.title")}
          </ButtonLink>
          <ButtonLink href="/family/rewards" variant="secondary" className={shortcutLinkClass}>
            {t("reward.title")}
          </ButtonLink>
          <ButtonLink href="/family/attendance" variant="secondary" className={shortcutLinkClass}>
            {t("attendance.title")}
          </ButtonLink>
          <ButtonLink href="/family/activity" variant="secondary" className={shortcutLinkClass}>
            {t("activity.title")}
          </ButtonLink>
          <ButtonLink href="/family/progress" variant="secondary" className={shortcutLinkClass}>
            {t("progress.title")}
          </ButtonLink>
          <ButtonLink href="/family/quran" variant="secondary" className={shortcutLinkClass}>
            {t("quran.title")}
          </ButtonLink>
          <ButtonLink href="/family/arabic" variant="secondary" className={shortcutLinkClass}>
            {t("arabic.title")}
          </ButtonLink>
          <ButtonLink href="/family/islamic-studies" variant="secondary" className={shortcutLinkClass}>
            {t("islamic.title")}
          </ButtonLink>
          <ButtonLink href="/family/ai" variant="secondary" className={shortcutLinkClass}>
            {t("ai.title")}
          </ButtonLink>
          <ButtonLink href="/family/wallet" variant="secondary" className={shortcutLinkClass}>
            {t("pay.wallet.title")}
          </ButtonLink>
          <ButtonLink href="/teachers" variant="secondary" className={shortcutLinkClass}>
            {t("nav.find_teachers")}
          </ButtonLink>
        </ShortcutLinkGrid>
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">
          {completeness.ready ? t("family.ready") : t("family.finish")}
        </h2>
        {completeness.ready ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            {t("family.ready_text")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm font-semibold text-brand">
            {completeness.missing.map((item) => (
              <li key={item} className="rounded-2xl bg-gold px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm">
          <Link href="/family/profile" className="font-bold text-brand underline">
            {t("family.complete")}
          </Link>
        </p>
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)] lg:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-extrabold text-brand">{t("family.children")}</h2>
          {canAddChild ? (
            <ButtonLink href="/family/children/new">{t("family.add_child")}</ButtonLink>
          ) : null}
        </div>
        {children.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {children.map((child) => (
              <li key={child.userId}>
                <Link
                  href={`/family/children/${child.userId}`}
                  className="block rounded-2xl bg-mint px-4 py-4 text-sm font-semibold text-brand hover:bg-gold"
                >
                  <p className="font-extrabold">{child.displayName}</p>
                  <p className="mt-1 text-muted">
                    {child.age != null
                      ? t("family.age", { age: child.age })
                      : t("family.age_unset")}
                    {" · "}
                    {child.currentLevelLabel ?? t("family.level_unset")}
                    {child.isPrimary ? ` · ${t("family.primary")}` : ""}
                  </p>
                  <p className="mt-1 text-muted">
                    {child.activeGoalCount
                      ? t(
                          child.activeGoalCount === 1
                            ? "family.goal_one"
                            : "family.goal_many",
                          { count: child.activeGoalCount },
                        )
                      : t("family.add_goal")}
                    {" · "}
                    {child.completedLessonCount
                      ? t(
                          child.completedLessonCount === 1
                            ? "family.lesson_one"
                            : "family.lesson_many",
                          { count: child.completedLessonCount },
                        )
                      : t("family.no_lessons")}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide">
                    {child.parentManaged ? t("family.managed") : t("family.linked")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">
            {t("family.children_empty")}
          </p>
        )}
        {!canAddChild ? (
          <p className="mt-4 text-sm text-muted">
            {t("family.max_children", { count: MAX_CHILDREN_PER_PARENT })}
          </p>
        ) : children.length ? (
          <p className="mt-4 text-sm">
            <Link
              href="/family/children/new"
              className="font-bold text-brand underline"
            >
              {t("family.add_another")}
            </Link>
          </p>
        ) : null}
        <p className="mt-4 text-sm">
          <Link href="/account" className="font-bold text-brand underline">
            {t("learn.account")}
          </Link>
        </p>
      </section>
    </div>
  );
}
