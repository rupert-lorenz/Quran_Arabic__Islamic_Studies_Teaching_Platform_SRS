import {
  LessonHistoryList,
  LessonHistorySummaryText,
} from "@/components/learning/lesson-history-list";
import { StudentProfileForm } from "@/components/students/student-profile-form";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { requireStudent } from "@/server/rbac/guard";
import { getLessonHistoryState } from "@/server/student/lessons";
import { getManagedStudentProfile } from "@/server/student/profile";
import Link from "next/link";

export const metadata = {
  title: "Student profile",
};

export default async function StudentProfilePage() {
  const access = await requireStudent();
  const [state, history] = await Promise.all([
    getManagedStudentProfile(access.user.id),
    getLessonHistoryState(access.user.id),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Your learning"
        title="Student profile"
        description="Keep your learner profile current. Lesson history for this profile sits beside your details."
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/learn" className="text-brand underline">
            Back to your learning home
          </Link>
          {" · "}
          <Link href="/learn/history" className="text-brand underline">
            Lesson history
          </Link>
        </p>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <StudentProfileForm
            initial={{
              displayName: state.displayName,
              ...state.profile,
            }}
            catalog={state.catalog}
            countries={state.countries}
            timezones={state.timezones}
          />
          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-xl font-extrabold text-brand">Lesson history</h2>
            <div className="mt-3">
              <LessonHistorySummaryText summary={history.summary} />
            </div>
            <div className="mt-4">
              <LessonHistoryList
                lessons={history.lessons.slice(0, 5)}
                manageHref="/learn/history"
                manageLabel="View all lessons"
                emptyText="No lessons on this profile yet."
              />
            </div>
          </section>
        </div>
      </Container>
    </PublicShell>
  );
}
