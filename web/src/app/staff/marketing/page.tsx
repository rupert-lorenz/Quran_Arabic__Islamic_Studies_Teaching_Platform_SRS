import { MarketingWorkspace } from "@/components/staff/marketing-workspace";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { requireStaffPage } from "@/server/rbac/guard";
import { listMarketingWorkspace } from "@/server/staff/marketing";

export const metadata = {
  title: "Marketing",
};

export default async function StaffMarketingPage() {
  const access = await requireStaffPage("marketing.campaigns");
  const workspace = await listMarketingWorkspace();

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Marketing</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Dedicated campaign workspace. Public pages, FAQs, articles, and banners
        live under Content.
      </p>
      <div className="mt-8">
        <MarketingWorkspace
          initial={workspace}
          canReport={hasAnyPermission(access, "reports.marketing")}
        />
      </div>
    </Container>
  );
}
