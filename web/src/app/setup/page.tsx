import { AuthShell } from "@/components/auth/auth-shell";
import { SetupForm } from "@/components/auth/setup-form";
import { PublicShell } from "@/components/layout/public-shell";
import { getBrand } from "@/server/brand";
import { getAccessContext, signedInHome } from "@/server/rbac/guard";
import { hasSuperAdmin } from "@/server/staff/accounts";
import Link from "next/link";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/server/cms/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "Super Admin setup",
    description: "One-time platform setup. This page is not for public search.",
    path: "/setup",
    index: false,
  });
}

export default async function SetupPage() {
  const [brand, access, exists] = await Promise.all([
    getBrand(),
    getAccessContext(),
    hasSuperAdmin(),
  ]);

  if (access) {
    redirect(signedInHome(access));
  }
  if (exists) {
    redirect("/login");
  }

  return (
    <PublicShell>
      <AuthShell brand={brand}>
        <SetupForm />
        <p className="mt-6 text-center text-sm font-semibold text-muted">
          Already created?{" "}
          <Link href="/login" className="text-brand underline">
            Log in
          </Link>
        </p>
      </AuthShell>
    </PublicShell>
  );
}
