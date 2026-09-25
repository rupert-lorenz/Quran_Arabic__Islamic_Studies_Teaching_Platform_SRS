import { LearningGoalsPanel } from "@/components/learning/learning-goals-panel";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { requireStudent } from "@/server/rbac/guard";
import { listLearningGoals } from "@/server/student/goals";
import { getManagedStudentProfile } from "@/server/student/profile";
import Link from "next/link";

export const metadata = {
  title: "Learning goals",
};

export default async function StudentGoalsPage() {
  const access = await requireStudent();
  const [profile, goals] = await Promise.all([
    getManagedStudentProfile(access.user.id),
    listLearningGoals(access.user.id),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Your learning"
        title="Learning goals"
        description="Tell teachers what you want to work toward. You can add, pause, or complete goals any time."
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/learn" className="text-brand underline">
            Back to your learning home
          </Link>
        </p>
        <LearningGoalsPanel
          goals={goals}
          catalog={profile.catalog}
          createAction="/api/v1/student/goals"
          itemActionBase="/api/v1/student/goals"
        />
      </Container>
    </PublicShell>
  );
}
