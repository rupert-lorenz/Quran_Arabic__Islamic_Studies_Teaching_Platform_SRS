import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PublicShell } from "@/components/layout/public-shell";
import { getI18n } from "@/server/i18n/locale";
import Link from "next/link";

import { pageMetadata } from "@/server/cms/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "Forgot password",
    description: "Request a password reset link for your account.",
    path: "/forgot-password",
    index: false,
  });
}

export default async function ForgotPasswordPage() {
  const { brand, t } = await getI18n();

  return (
    <PublicShell>
      <AuthShell brand={brand}>
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm font-semibold text-muted">
          <Link href="/login" className="text-brand underline">
            {t("auth.back_login")}
          </Link>
        </p>
      </AuthShell>
    </PublicShell>
  );
}
