import { StaffClassroomBrand } from "@/components/staff/staff-classroom-brand";
import { Container } from "@/components/ui/container";
import { getClassroomBrandWorkspace } from "@/server/classroom/brand";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Brand",
};

export default async function StaffBrandPage() {
  await requireStaffPage("settings.write");
  const { brand, overlay } = await getClassroomBrandWorkspace();

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Classroom brand</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Configure the in-platform classroom overlay. The company mark, colours,
        and name stay on the lesson so families never leave {brand.name} for a
        third-party meeting room.
      </p>
      <div className="mt-8">
        <StaffClassroomBrand brand={brand} initial={overlay} />
      </div>
    </Container>
  );
}
