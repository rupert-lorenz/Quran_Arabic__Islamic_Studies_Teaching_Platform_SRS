import { StaffCountries } from "@/components/staff/staff-countries";
import { Container } from "@/components/ui/container";
import { requireStaffPage } from "@/server/rbac/guard";
import { listCountryWorkspace } from "@/server/staff/countries";

export const metadata = {
  title: "Countries",
};

export default async function StaffCountriesPage() {
  await requireStaffPage("settings.write");
  const workspace = await listCountryWorkspace();

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Countries</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Control which countries families and teachers can choose. Each country
        keeps a default timezone and currency for later pricing and display.
      </p>
      <div className="mt-8">
        <StaffCountries initial={workspace} />
      </div>
    </Container>
  );
}
