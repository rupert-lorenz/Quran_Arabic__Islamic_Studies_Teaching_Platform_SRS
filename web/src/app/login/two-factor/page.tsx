import { AuthShell } from "@/components/auth/auth-shell";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { PublicShell } from "@/components/layout/public-shell";
import { getI18n } from "@/server/i18n/locale";
import { getAccessContext, signedInHome } from "@/server/rbac/guard";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/server/cms/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "Two-factor authentication",
    description: "Enter your authentication code to finish signing in.",
    path: "/login/two-factor",
    index: false,
  });
}

export default async function TwoFactorLoginPage() {
  const [{ brand }, access] = await Promise.all([getI18n(), getAccessContext()]);
  if (access) {
    redirect(signedInHome(access));
  }

  return (
    <PublicShell>
      <AuthShell brand={brand}>
        <TwoFactorForm />
      </AuthShell>
    </PublicShell>
  );
}
