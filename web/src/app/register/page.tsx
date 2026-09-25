import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { PublicShell } from "@/components/layout/public-shell";
import { getI18n } from "@/server/i18n/locale";
import { getAccessContext, signedInHome } from "@/server/rbac/guard";
import { hasSuperAdmin } from "@/server/staff/accounts";
import { listEnabledCountries } from "@/server/student/profile";
import Link from "next/link";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/server/cms/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "Get started",
    description: "Create a parent, student, or teacher account on the platform.",
    path: "/register",
    index: false,
  });
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ role }, { brand, t }, access, setupNeeded, countries] = await Promise.all([
    searchParams,
    getI18n(),
    getAccessContext(),
    hasSuperAdmin().then((exists) => !exists),
    listEnabledCountries(),
  ]);
  if (access) {
    redirect(signedInHome(access));
  }

  return (
    <PublicShell>
      <AuthShell brand={brand}>
        <RegisterForm
          defaultRole={
            role === "teacher" || role === "student" || role === "parent"
              ? role
              : "parent"
          }
          countries={countries}
        />
        <p className="mt-6 text-center text-sm font-semibold text-muted">
          {t("auth.already")}{" "}
          <Link href="/login" className="text-brand underline">
            {t("nav.login")}
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
