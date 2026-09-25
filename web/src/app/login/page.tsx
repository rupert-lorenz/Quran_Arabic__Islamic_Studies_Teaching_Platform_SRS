import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { PublicShell } from "@/components/layout/public-shell";
import { getI18n } from "@/server/i18n/locale";
import { getAccessContext, signedInHome } from "@/server/rbac/guard";
import { hasSuperAdmin } from "@/server/staff/accounts";
import Link from "next/link";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/server/cms/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "Log in",
    description: "Sign in to your parent, student, teacher, or staff account.",
    path: "/login",
    index: false,
  });
}

export default async function LoginPage() {
  const [{ brand, t }, access, setupNeeded] = await Promise.all([
    getI18n(),
    getAccessContext(),
    hasSuperAdmin().then((exists) => !exists),
  ]);
  if (access) {
    redirect(signedInHome(access));
  }

  return (
    <PublicShell>
      <AuthShell brand={brand}>
        <LoginForm />
        <p className="mt-6 text-center text-sm font-semibold text-muted">
          {t("auth.new_here")}{" "}
          <Link href="/register" className="text-brand underline">
            {t("auth.create_account")}
          </Link>
        </p>
        {setupNeeded ? (
          <p className="mt-3 text-center text-sm font-semibold">
            <Link href="/setup" className="text-brand underline">
              {t("auth.create_super")}
            </Link>
          </p>
        ) : null}
      </AuthShell>
    </PublicShell>
  );
}
