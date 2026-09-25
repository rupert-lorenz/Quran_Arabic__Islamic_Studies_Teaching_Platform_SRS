import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { PublicShell } from "@/components/layout/public-shell";
import { getI18n } from "@/server/i18n/locale";

import { pageMetadata } from "@/server/cms/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "Reset password",
    description: "Choose a new password for your account.",
    path: "/reset-password",
    index: false,
  });
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { brand } = await getI18n();
  const { token } = await searchParams;

  return (
    <PublicShell>
      <AuthShell brand={brand}>
        <ResetPasswordForm token={token ?? ""} />
      </AuthShell>
    </PublicShell>
  );
}
