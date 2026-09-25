import { ChildProfileForm } from "@/components/parents/child-profile-form";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getManagedParentProfile } from "@/server/parent/profile";
import { requireParent } from "@/server/rbac/guard";
import { listEnabledSubjects } from "@/server/student/profile";
import Link from "next/link";

export const metadata = {
  title: "Add a child",
};

export default async function AddChildPage() {
  const access = await requireParent();
  const [family, catalog] = await Promise.all([
    getManagedParentProfile(access.user.id),
    listEnabledSubjects(),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Your family"
        title="Add a child"
        description="Create a separate learning profile for each child. They will not have their own login."
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/family" className="text-brand underline">
            Back to your family home
          </Link>
        </p>
        <ChildProfileForm
          title="New child profile"
          action="/api/v1/parent/children"
          method="POST"
          initial={{
            displayName: "",
            dateOfBirth: "",
            currentLevel: "",
            country: family.profile.country,
            languages: "",
            gender: "",
            about: "",
            subjectSlugs: [],
          }}
          catalog={catalog}
          countries={family.countries}
        />
      </Container>
    </PublicShell>
  );
}
