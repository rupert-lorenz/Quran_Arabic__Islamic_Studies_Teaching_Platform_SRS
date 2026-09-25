import { AccountsWorkspace } from "@/components/staff/accounts-workspace";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { requireStaffPage } from "@/server/rbac/guard";
import { listFinanceWorkspace } from "@/server/staff/finance";

export const metadata = {
  title: "Accounts",
};

export default async function StaffAccountsPage() {
  const access = await requireStaffPage("payments.read");
  const workspace = await listFinanceWorkspace();

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Accounts</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Dedicated finance workspace. Refunds and payouts stay behind their own
        permission keys.
      </p>
      <div className="mt-8">
        <AccountsWorkspace
          initial={workspace}
          canRefund={hasAnyPermission(access, "payments.refund")}
          canPayout={hasAnyPermission(access, "payouts.manage")}
          canReport={hasAnyPermission(access, "reports.finance")}
        />
      </div>
    </Container>
  );
}
