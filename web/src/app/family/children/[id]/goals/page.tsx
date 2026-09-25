import { LearningGoalsPanel } from "@/components/learning/learning-goals-panel";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { isApiError } from "@/server/api/errors";
import { getManagedParentChild } from "@/server/parent/children";
import { requireParent } from "@/server/rbac/guard";
import { listLearningGoals } from "@/server/student/goals";
import { notFound } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Child learning goals",
};

export default async function ChildGoalsPage({
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

  const goals = await listLearningGoals(child.userId);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Your family"
        title={`${child.displayName}'s goals`}
        description="Set what this child is working toward. Each child keeps their own goals on this family account."
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link
            href={`/family/children/${child.userId}`}
            className="text-brand underline"
          >
            Back to {child.displayName}'s profile
          </Link>
          {" · "}
          <Link href="/family" className="text-brand underline">
            Family home
          </Link>
        </p>
        <LearningGoalsPanel
          goals={goals}
          catalog={child.catalog}
          createAction={`/api/v1/parent/children/${child.userId}/goals`}
          itemActionBase={`/api/v1/parent/children/${child.userId}/goals`}
        />
      </Container>
    </PublicShell>
  );
}
