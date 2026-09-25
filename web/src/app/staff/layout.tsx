import { Suspense } from "react";
import { StaffNav } from "@/components/staff/staff-nav";
import { StaffSearchForm } from "@/components/staff/staff-search-form";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { requireStaffPage } from "@/server/rbac/guard";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireStaffPage();

  return (
    <PublicShell>
      <div className="logo-hang-band border-b border-line bg-mint/60">
        <Container className="pb-4">
          <p className="text-sm font-extrabold tracking-[0.18em] text-brand-accent uppercase">
            Staff · {access.user.roleKey.replaceAll("_", " ")}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <StaffNav
              permissions={access.permissions}
              roleKey={access.user.roleKey}
            />
            <Suspense fallback={null}>
              <StaffSearchForm compact />
            </Suspense>
          </div>
        </Container>
      </div>
      {children}
    </PublicShell>
  );
}
