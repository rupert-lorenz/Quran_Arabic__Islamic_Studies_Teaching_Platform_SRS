import { StaffSeo } from "@/components/staff/staff-seo";
import { Container } from "@/components/ui/container";
import { requireStaffPage } from "@/server/rbac/guard";
import { getSeoWorkspace } from "@/server/seo/site";

export const metadata = {
  title: "SEO",
};

export default async function StaffSeoPage() {
  await requireStaffPage(["settings.write", "cms.write"]);
  const workspace = await getSeoWorkspace();

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">SEO</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Control default titles and descriptions, indexing, sitemap inclusion,
        and canonical public URLs. Per-page SEO title and description stay on
        Content.
      </p>
      <div className="mt-8">
        <StaffSeo initial={workspace} />
      </div>
    </Container>
  );
}
