import { StaffSearchResults } from "@/components/staff/staff-search-results";
import { Container } from "@/components/ui/container";
import { requireStaffPage } from "@/server/rbac/guard";
import { searchStaff } from "@/server/staff/search";

export const metadata = {
  title: "Search",
};

export default async function StaffSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const access = await requireStaffPage();
  const { q } = await searchParams;
  const result = await searchStaff(access, q);

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Global search</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Find users, teacher applications, lessons, finance items, campaigns,
        countries, and safeguarding records you are allowed to open.
      </p>
      <div className="mt-8">
        <StaffSearchResults result={result} />
      </div>
    </Container>
  );
}
