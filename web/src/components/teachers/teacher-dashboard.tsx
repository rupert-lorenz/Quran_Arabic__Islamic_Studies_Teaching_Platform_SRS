import Link from "next/link";
import { DashboardOverview } from "@/components/dashboard/dashboard-panel";
import {
  LessonHistoryList,
  LessonHistorySummaryText,
} from "@/components/learning/lesson-history-list";
import { TeacherRateBreakdown } from "@/components/teachers/teacher-rate-breakdown";
import { ButtonLink } from "@/components/ui/button";
import {
  ShortcutLinkGrid,
  shortcutLinkClass,
} from "@/components/ui/shortcut-link-grid";
import { applicationStatusLabel } from "@/lib/teacher-status";
import type { getTeacherDashboard } from "@/server/dashboard";
import { getI18n } from "@/server/i18n/locale";
import { UpcomingLessonCard } from "@/components/bookings/upcoming-lesson-card";

type TeacherDashboardState = Awaited<ReturnType<typeof getTeacherDashboard>>;

export async function TeacherDashboard({
  displayName,
  dashboard,
}: {
  displayName: string;
  dashboard: TeacherDashboardState;
}) {
  const { t } = await getI18n();
  const { summary, profile, history, approved, missing, stats, actions } =
    dashboard;
  const rate = profile?.rate ?? summary.rate ?? null;

  return (
    <div className="space-y-6">
      <DashboardOverview stats={stats} actions={actions} />

      {approved ? (
        <UpcomingLessonCard
          lesson={dashboard.nextLesson}
          href="/teach/bookings"
          withName="student"
          role="teacher"
        />
      ) : null}

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">
          {approved ? t("teach_dash.workspace") : t("teach_dash.application")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {displayName} · {applicationStatusLabel(summary.verificationStatus)}
          {summary.email ? ` · ${summary.email}` : ""}
        </p>
        {summary.reviewNote ? (
          <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
            {t("teach_dash.staff_note", { note: summary.reviewNote })}
          </p>
        ) : null}
        {approved && missing.length ? (
          <ul className="mt-4 space-y-2 text-sm font-semibold text-brand">
            {missing.map((item) => (
              <li key={item} className="rounded-2xl bg-gold px-4 py-3">
                {t("teach_dash.missing", { item })}
              </li>
            ))}
          </ul>
        ) : null}
        <ShortcutLinkGrid label={t("teach_dash.status")} className="mt-6 xl:grid-cols-3">
          <ButtonLink href="/teach/status" variant="secondary" className={shortcutLinkClass}>
            {t("teach_dash.status")}
          </ButtonLink>
          {approved ? (
            <>
              <ButtonLink href="/teach/profile" variant="secondary" className={shortcutLinkClass}>
                {t("teach_dash.profile")}
              </ButtonLink>
              <ButtonLink href="/teach/availability" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.availability")}
              </ButtonLink>
              <ButtonLink href="/teach/bookings" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.bookings")}
              </ButtonLink>
              <ButtonLink href="/teach/library" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.library")}
              </ButtonLink>
              <ButtonLink href="/teach/homework" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.homework")}
              </ButtonLink>
              <ButtonLink href="/teach/games" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.games")}
              </ButtonLink>
              <ButtonLink href="/teach/quizzes" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.quizzes")}
              </ButtonLink>
              <ButtonLink href="/teach/exams" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.exams")}
              </ButtonLink>
              <ButtonLink href="/teach/marking" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.marking")}
              </ButtonLink>
              <ButtonLink href="/teach/reports" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.reports")}
              </ButtonLink>
              <ButtonLink href="/teach/certificates" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.certificates")}
              </ButtonLink>
              <ButtonLink href="/teach/rewards" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.rewards")}
              </ButtonLink>
              <ButtonLink href="/teach/attendance" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.attendance")}
              </ButtonLink>
              <ButtonLink href="/teach/activity" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.activity")}
              </ButtonLink>
              <ButtonLink href="/teach/progress" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.progress")}
              </ButtonLink>
              <ButtonLink href="/teach/quran" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.quran")}
              </ButtonLink>
              <ButtonLink href="/teach/arabic" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.arabic")}
              </ButtonLink>
              <ButtonLink href="/teach/islamic-studies" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.islamic")}
              </ButtonLink>
              <ButtonLink href="/teach/ai" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.ai")}
              </ButtonLink>
              <ButtonLink href="/teach/earnings" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.earnings")}
              </ButtonLink>
              <ButtonLink href="/teach/questions" variant="secondary" className={shortcutLinkClass}>
                {t("teach_nav.questions")}
              </ButtonLink>
              <ButtonLink href="/teach/video" variant="secondary" className={shortcutLinkClass}>
                {t("teach_dash.video")}
              </ButtonLink>
              <ButtonLink href="/teach/agreement" variant="secondary" className={shortcutLinkClass}>
                {t("teach_dash.agreement")}
              </ButtonLink>
              {profile?.publicPath ? (
                <ButtonLink href={profile.publicPath} variant="secondary" className={shortcutLinkClass}>
                  {t("teach_dash.public")}
                </ButtonLink>
              ) : null}
            </>
          ) : (
            <ButtonLink href="/teach/onboarding" variant="secondary" className={shortcutLinkClass}>
              {t("teach_dash.application")}
            </ButtonLink>
          )}
          <ButtonLink href="/account" variant="secondary" className={shortcutLinkClass}>
            {t("learn.account")}
          </ButtonLink>
        </ShortcutLinkGrid>
      </section>

      {approved ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-xl font-extrabold text-brand">Lesson rate</h2>
            {rate ? (
              <div className="mt-4">
                <TeacherRateBreakdown
                  rate={rate}
                  revealInternalPayment
                  title="Listed price split"
                />
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">
                Set an hourly rate so families see a student price and your net
                earnings.
              </p>
            )}
            {profile?.publicPath ? (
              <p className="mt-4 text-sm">
                <Link
                  href={profile.publicPath}
                  className="font-bold text-brand underline"
                >
                  Open public profile
                </Link>
              </p>
            ) : null}
          </div>
          <div className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-xl font-extrabold text-brand">Booking</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Publish working hours so families can book one-to-one lessons on
              your public profile. Add breaks so lunch or Jummah cannot be booked.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink href="/teach/availability" variant="secondary">
                Set working hours
              </ButtonLink>
              <ButtonLink href="/teach/bookings" variant="secondary">
                Open calendar
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-xl font-extrabold text-brand">Booking</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Booking opens later, after staff approve your application. Finish
            the items on your application, then wait for review.
          </p>
        </section>
      )}

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-extrabold text-brand">Recent classes</h2>
          <ButtonLink href="/teach/status" variant="secondary">
            Verification details
          </ButtonLink>
        </div>
        <div className="mt-3">
          <LessonHistorySummaryText summary={history.summary} />
        </div>
        <div className="mt-4">
          <LessonHistoryList
            lessons={history.lessons.slice(0, 4)}
            emptyText="No recorded classes yet. Completing a booked lesson writes it here automatically."
          />
        </div>
      </section>
    </div>
  );
}
