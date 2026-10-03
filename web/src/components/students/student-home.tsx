import Link from "next/link";
import { DashboardOverview } from "@/components/dashboard/dashboard-panel";
import { ButtonLink } from "@/components/ui/button";
import {
  ShortcutLinkGrid,
  shortcutLinkClass,
} from "@/components/ui/shortcut-link-grid";
import {
  LessonHistoryList,
  LessonHistorySummaryText,
} from "@/components/learning/lesson-history-list";
import type { DashboardAction, DashboardStat } from "@/lib/dashboard";
import type { LearningGoalView } from "@/lib/learning-goals";
import type { LessonHistorySummary, LessonHistoryView } from "@/lib/lesson-history";
import { getI18n } from "@/server/i18n/locale";
import type { getManagedStudentProfile } from "@/server/student/profile";
import { UpcomingLessonCard } from "@/components/bookings/upcoming-lesson-card";
import type { BookingView } from "@/lib/booking";

type StudentProfileState = Awaited<ReturnType<typeof getManagedStudentProfile>>;

export async function StudentHome({
  displayName,
  profile,
  goals,
  history,
  nextLesson,
  stats,
  actions,
}: {
  displayName: string;
  profile: StudentProfileState;
  goals: LearningGoalView[];
  history: { lessons: LessonHistoryView[]; summary: LessonHistorySummary };
  nextLesson: BookingView | null;
  stats: DashboardStat[];
  actions: DashboardAction[];
}) {
  const { t } = await getI18n();
  const { completeness } = profile;
  const subjectNames = profile.catalog
    .filter((subject) => profile.profile.subjectSlugs.includes(subject.slug))
    .map((subject) => subject.name);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="lg:col-span-2">
        <DashboardOverview stats={stats} actions={actions} />
      </div>
      <UpcomingLessonCard lesson={nextLesson} href="/learn/bookings" />
      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">{t("learn.profile")}</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("common.name")}</dt>
            <dd className="font-bold text-brand">{displayName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("learn.level")}</dt>
            <dd className="font-bold text-brand">
              {profile.profile.currentLevelLabel ?? t("learn.add_level")}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("common.country")}</dt>
            <dd className="font-bold text-brand">
              {profile.profile.countryName ?? t("learn.add_country")}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("learn.subjects")}</dt>
            <dd className="text-end font-bold text-brand">
              {subjectNames.length ? subjectNames.join(", ") : t("learn.choose_subjects")}
            </dd>
          </div>
        </dl>
        {profile.profile.about ? (
          <p className="mt-4 text-sm leading-6 text-muted">{profile.profile.about}</p>
        ) : null}
        <ShortcutLinkGrid label={t("learn.edit_profile")} className="mt-6">
          <ButtonLink href="/learn/profile" className={shortcutLinkClass}>
            {t("learn.edit_profile")}
          </ButtonLink>
          <ButtonLink href="/learn/bookings" variant="secondary" className={shortcutLinkClass}>
            {t("booking.your_bookings")}
          </ButtonLink>
          <ButtonLink href="/messages" variant="secondary" className={shortcutLinkClass}>
            {t("messages.nav")}
          </ButtonLink>
          <ButtonLink href="/learn/guide" variant="secondary" className={shortcutLinkClass}>
            {t("dc.student.title")}
          </ButtonLink>
          <ButtonLink href="/mobile" variant="secondary" className={shortcutLinkClass}>
            {t("mb.nav")}
          </ButtonLink>
          <ButtonLink href="/learn/library" variant="secondary" className={shortcutLinkClass}>
            {t("library.title")}
          </ButtonLink>
          <ButtonLink href="/learn/homework" variant="secondary" className={shortcutLinkClass}>
            {t("homework.title")}
          </ButtonLink>
          <ButtonLink href="/learn/games" variant="secondary" className={shortcutLinkClass}>
            {t("games.title")}
          </ButtonLink>
          <ButtonLink href="/learn/quizzes" variant="secondary" className={shortcutLinkClass}>
            {t("quiz.title")}
          </ButtonLink>
          <ButtonLink href="/learn/exams" variant="secondary" className={shortcutLinkClass}>
            {t("exam.title")}
          </ButtonLink>
          <ButtonLink href="/learn/reports" variant="secondary" className={shortcutLinkClass}>
            {t("report.title")}
          </ButtonLink>
          <ButtonLink href="/learn/certificates" variant="secondary" className={shortcutLinkClass}>
            {t("cert.title")}
          </ButtonLink>
          <ButtonLink href="/learn/rewards" variant="secondary" className={shortcutLinkClass}>
            {t("reward.title")}
          </ButtonLink>
          <ButtonLink href="/learn/attendance" variant="secondary" className={shortcutLinkClass}>
            {t("attendance.title")}
          </ButtonLink>
          <ButtonLink href="/learn/activity" variant="secondary" className={shortcutLinkClass}>
            {t("activity.title")}
          </ButtonLink>
          <ButtonLink href="/learn/progress" variant="secondary" className={shortcutLinkClass}>
            {t("progress.title")}
          </ButtonLink>
          <ButtonLink href="/learn/quran" variant="secondary" className={shortcutLinkClass}>
            {t("quran.title")}
          </ButtonLink>
          <ButtonLink href="/learn/arabic" variant="secondary" className={shortcutLinkClass}>
            {t("arabic.title")}
          </ButtonLink>
          <ButtonLink href="/learn/islamic-studies" variant="secondary" className={shortcutLinkClass}>
            {t("islamic.title")}
          </ButtonLink>
          <ButtonLink href="/learn/ai" variant="secondary" className={shortcutLinkClass}>
            {t("ai.title")}
          </ButtonLink>
          <ButtonLink href="/teachers" variant="secondary" className={shortcutLinkClass}>
            {t("nav.find_teachers")}
          </ButtonLink>
        </ShortcutLinkGrid>
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">
          {completeness.ready ? t("learn.ready") : t("learn.finish")}
        </h2>
        {completeness.ready ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            {t("learn.ready_text")}
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
          <Link href="/learn/profile" className="font-bold text-brand underline">
            {t("learn.complete")}
          </Link>
        </p>
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)] lg:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-extrabold text-brand">{t("learn.goals")}</h2>
          <ButtonLink href="/learn/goals" variant="secondary">
            {goals.length ? t("learn.manage_goals") : t("learn.add_goal")}
          </ButtonLink>
        </div>
        {goals.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {goals.slice(0, 4).map((goal) => (
              <li
                key={goal.id}
                className="rounded-2xl bg-mint px-4 py-4 text-sm font-semibold text-brand"
              >
                <p className="font-extrabold">{goal.title}</p>
                <p className="mt-1 text-muted">
                  {goal.statusLabel}
                  {goal.subjectName ? ` - ${goal.subjectName}` : ""}
                  {goal.targetDate ? ` - ${goal.targetDate}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">
            {t("learn.goals_empty")}
          </p>
        )}
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)] lg:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-extrabold text-brand">{t("learn.history")}</h2>
          <ButtonLink href="/learn/history" variant="secondary">
            {history.lessons.length ? t("learn.view_lessons") : t("learn.open_history")}
          </ButtonLink>
        </div>
        <div className="mt-3">
          <LessonHistorySummaryText summary={history.summary} />
        </div>
        <div className="mt-4">
          <LessonHistoryList
            lessons={history.lessons.slice(0, 4)}
            emptyText={t("learn.history_empty")}
          />
        </div>
        <p className="mt-4 text-sm">
          <Link href="/account" className="font-bold text-brand underline">
            {t("learn.account")}
          </Link>
        </p>
      </section>
    </div>
  );
}
