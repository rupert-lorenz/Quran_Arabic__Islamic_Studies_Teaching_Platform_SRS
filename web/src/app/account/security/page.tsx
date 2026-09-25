import { TwoFactorSettings } from "@/components/account/two-factor-settings";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getTwoFactorStatus } from "@/server/auth/two-factor";
import { getServerUser } from "@/server/auth/session";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Account security",
};

export default async function AccountSecurityPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  const status = await getTwoFactorStatus(user);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Security"
        title="Two-factor authentication"
        description={
          status.required
            ? "Privileged accounts must confirm sign-in with an authenticator app."
            : "Marketplace accounts sign in with email and password only."
        }
      />
      <Container className="py-10">
        <section className="max-w-xl rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <TwoFactorSettings {...status} />
        </section>
      </Container>
    </PublicShell>
  );
}
