import { CrmFacultiesView } from "@/components/crm/crm-faculties";
import { CrmWorkspace } from "@/components/crm/crm-workspace";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { getCrmFaculties } from "@/server/crm/faculties";
import { listCrmWorkspace } from "@/server/crm/records";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "CRM",
};

const accessPermissions = [
  "crm.manage",
  "support.tickets",
  "reports.finance",
  "reports.academic",
  "reports.marketing",
  "users.read",
  "payments.read",
];

export default async function StaffCrmPage() {
  const access = await requireStaffPage(accessPermissions);
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const canCrm = hasAnyPermission(access, "crm.manage");
  const canTickets = hasAnyPermission(access, "support.tickets");
  const [faculties, workspace] = await Promise.all([
    getCrmFaculties(actor),
    canCrm || canTickets
      ? listCrmWorkspace(actor)
      : Promise.resolve({ accounts: [], tickets: [], staff: [] }),
  ]);

  return (
    <Container className="space-y-8 py-10">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-brand">
          CRM, support and analytics
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Leads move through a fixed status list. Tickets keep a category, priority,
          owner, and attachments. Reports export as CSV, Excel, or PDF. Families do
          not see teacher payouts or another teacher&apos;s revenue.
        </p>
      </div>
      <CrmWorkspace initial={workspace} canCrm={canCrm} canTickets={canTickets} />
      <CrmFacultiesView faculties={faculties} />
    </Container>
  );
}
