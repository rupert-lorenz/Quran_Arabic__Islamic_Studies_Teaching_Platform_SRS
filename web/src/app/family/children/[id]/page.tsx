import {
  LessonHistoryList,
  LessonHistorySummaryText,
} from "@/components/learning/lesson-history-list";
import { ChildProfileForm } from "@/components/parents/child-profile-form";
import { PublicShell } from "@/components/layout/public-shell";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import {
  ShortcutLinkGrid,
  shortcutLinkClass,
} from "@/components/ui/shortcut-link-grid";
import { PageHero } from "@/components/ui/page-hero";
import { isApiError } from "@/server/api/errors";
import { getManagedParentChild } from "@/server/parent/children";
import { requireParent } from "@/server/rbac/guard";
import { listLearningGoals } from "@/server/student/goals";
import { getLessonHistoryState } from "@/server/student/lessons";
import { notFound } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Child profile",
};

export default async function ChildProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireParent();
  const { id } = await params;

  let child;
  try {
    child = await getManagedParentChild(access.user.id, id);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const [goals, history] = await Promise.all([
    listLearningGoals(child.userId),
    getLessonHistoryState(child.userId),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Your family"
        title={child.displayName}
        description="Keep this child's profile, goals, and lesson history up to date in one place."
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/family" className="text-brand underline">
            Back to your family home
          </Link>
        </p>
        <section className="mb-6 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-extrabold text-brand">Learning goals</h2>
            <ButtonLink href={`/family/children/${child.userId}/goals`}>
              {goals.length ? "Manage goals" : "Add a goal"}
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
                    {goal.subjectName ? ` · ${goal.subjectName}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted">
              Set a goal for this child, such as fluent recitation or a Hifdh
              portion, before booking opens.
            </p>
          )}
        </section>
        <section className="mb-6 min-w-0 overflow-x-clip rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            Lesson history
          </h2>
          <ShortcutLinkGrid label="Child learning pages" className="mt-4 xl:grid-cols-3">
            <ButtonLink
              href={`/family/children/${child.userId}/history`}
              className={shortcutLinkClass}
            >
              {history.lessons.length ? "View all lessons" : "Open history"}
            </ButtonLink>
            <ButtonLink
              href={`/family/children/${child.userId}/reports`}
              variant="secondary"
              className={shortcutLinkClass}
            >
              Student report
            </ButtonLink>
            <ButtonLink
              href={`/family/children/${child.userId}/certificates`}
              variant="secondary"
              className={shortcutLinkClass}
            >
              Certificates
            </ButtonLink>
            <ButtonLink
              href={`/family/children/${child.userId}/rewards`}
              variant="secondary"
              className={shortcutLinkClass}
            >
              Rewards
            </ButtonLink>
            <ButtonLink
              href={`/family/children/${child.userId}/attendance`}
              variant="secondary"
              className={shortcutLinkClass}
            >
              Attendance
            </ButtonLink>
            <ButtonLink
              href={`/family/children/${child.userId}/activity`}
              variant="secondary"
              className={shortcutLinkClass}
            >
              Login and lesson times
            </ButtonLink>
            <ButtonLink
              href={`/family/children/${child.userId}/progress`}
              variant="secondary"
              className={shortcutLinkClass}
            >
              Islamic education progress
            </ButtonLink>
            <ButtonLink
              href={`/family/children/${child.userId}/quran`}
              variant="secondary"
              className={shortcutLinkClass}
            >
              Qur'an and Hifdh
            </ButtonLink>
            <ButtonLink
              href={`/family/children/${child.userId}/arabic`}
              variant="secondary"
              className={shortcutLinkClass}
            >
              Arabic language
            </ButtonLink>
            <ButtonLink
              href={`/family/children/${child.userId}/islamic-studies`}
              variant="secondary"
              className={shortcutLinkClass}
            >
              Islamic Studies
            </ButtonLink>
            <ButtonLink
              href={`/family/children/${child.userId}/ai`}
              variant="secondary"
              className={shortcutLinkClass}
            >
              AI Systems
            </ButtonLink>
          </ShortcutLinkGrid>
          <div className="mt-3">
            <LessonHistorySummaryText summary={history.summary} />
          </div>
          <div className="mt-4">
            <LessonHistoryList
              lessons={history.lessons.slice(0, 3)}
              emptyText="No lessons have been recorded for this child yet."
            />
          </div>
        </section>
        <ChildProfileForm
          title="Child profile"
          action={`/api/v1/parent/children/${child.userId}`}
          method="PATCH"
          initial={{
            displayName: child.displayName,
            ...child.profile,
          }}
          catalog={child.catalog}
          countries={child.countries}
          isPrimary={child.isPrimary}
          canRemove={child.parentManaged}
        />
      </Container>
    </PublicShell>
  );
}
