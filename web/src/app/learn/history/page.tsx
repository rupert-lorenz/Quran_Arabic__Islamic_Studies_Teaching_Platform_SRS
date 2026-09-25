import {
  LessonHistoryList,
  LessonHistorySummaryText,
} from "@/components/learning/lesson-history-list";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ClassroomRecordingLibrary } from "@/components/classroom/classroom-recording-library";
import { listAccessibleRecordings } from "@/server/classroom/recording-access";
import { requireStudent } from "@/server/rbac/guard";
import { getLessonHistoryState } from "@/server/student/lessons";
import Link from "next/link";

export const metadata = {
  title: "Lesson history",
};

export default async function StudentLessonHistoryPage() {
  const access = await requireStudent();
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [history, library] = await Promise.all([
    getLessonHistoryState(access.user.id),
    listAccessibleRecordings(actor),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Your learning"
        title="Lesson history"
        description="Completed, cancelled, and missed lessons stay on your student profile. Booking will add to this list automatically later."
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/learn" className="text-brand underline">
            Back to your learning home
          </Link>
          {" · "}
          <Link href="/learn/profile" className="text-brand underline">
            Student profile
          </Link>
        </p>
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-xl font-extrabold text-brand">Your lessons</h2>
          <div className="mt-3">
            <LessonHistorySummaryText summary={history.summary} />
          </div>
          <div className="mt-4">
            <LessonHistoryList
              lessons={history.lessons}
              emptyText="No lessons have been recorded yet. After your first class, it will show here with the teacher, subject, and time."
            />
          </div>
        </section>
        <div className="mt-6">
          <ClassroomRecordingLibrary
            recordings={library.recordings}
            retentionDays={library.retentionDays}
          />
        </div>
      </Container>
    </PublicShell>
  );
}
