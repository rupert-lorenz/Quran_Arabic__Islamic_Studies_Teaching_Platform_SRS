import {
  LessonHistoryList,
  LessonHistorySummaryText,
} from "@/components/learning/lesson-history-list";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { isApiError } from "@/server/api/errors";
import { ClassroomRecordingLibrary } from "@/components/classroom/classroom-recording-library";
import { listAccessibleRecordings } from "@/server/classroom/recording-access";
import { getManagedParentChild } from "@/server/parent/children";
import { requireParent } from "@/server/rbac/guard";
import { getLessonHistoryState } from "@/server/student/lessons";
import { notFound } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Child lesson history",
};

export default async function ChildLessonHistoryPage({
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

  const history = await getLessonHistoryState(child.userId);
  const library = await listAccessibleRecordings(
    {
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    },
    { studentUserId: child.userId },
  );

  return (
    <PublicShell>
      <PageHero
        eyebrow="Your family"
        title={`${child.displayName}'s lessons`}
        description="This child's completed, cancelled, and missed lessons stay on their profile."
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link
            href={`/family/children/${child.userId}`}
            className="text-brand underline"
          >
            {`Back to ${child.displayName}'s profile`}
          </Link>
          {" · "}
          <Link href="/family" className="text-brand underline">
            Family home
          </Link>
        </p>
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-xl font-extrabold text-brand">Lesson history</h2>
          <div className="mt-3">
            <LessonHistorySummaryText summary={history.summary} />
          </div>
          <div className="mt-4">
            <LessonHistoryList
              lessons={history.lessons}
              emptyText="No lessons have been recorded for this child yet."
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
