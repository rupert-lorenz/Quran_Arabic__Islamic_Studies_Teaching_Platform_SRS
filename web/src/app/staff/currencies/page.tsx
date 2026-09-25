import { StaffCurrencies } from "@/components/staff/staff-currencies";
import { Container } from "@/components/ui/container";
import { requireStaffPage } from "@/server/rbac/guard";
import { listCurrencyWorkspace } from "@/server/staff/currencies";

export const metadata = {
  title: "Currencies",
};

export default async function StaffCurrenciesPage() {
  const access = await requireStaffPage(["settings.write", "payments.read"]);
  const workspace = await listCurrencyWorkspace({
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  });

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Currencies</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Money is stored as integer minor units plus an ISO code. Display currency
        follows the visitor cookie, then the signed-in account, then the country
        default. Settlement stays in the listed currency until billing ships.
      </p>
      <div className="mt-8">
        <StaffCurrencies initial={workspace} />
      </div>
    </Container>
  );
}
