import { ParentProfileForm } from "@/components/parents/parent-profile-form";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getManagedParentProfile } from "@/server/parent/profile";
import { requireParent } from "@/server/rbac/guard";
import Link from "next/link";

export const metadata = {
  title: "Family profile",
};

export default async function FamilyProfilePage() {
  const access = await requireParent();
  const state = await getManagedParentProfile(access.user.id);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Your family"
        title="Family profile"
        description="Tell us who you are to this family. Phone numbers stay with platform staff and are never shown to teachers."
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/family" className="text-brand underline">
            Back to your family home
          </Link>
        </p>
        <ParentProfileForm
          initial={{
            displayName: state.displayName,
            ...state.profile,
          }}
          countries={state.countries}
          timezones={state.timezones}
        />
      </Container>
    </PublicShell>
  );
}
