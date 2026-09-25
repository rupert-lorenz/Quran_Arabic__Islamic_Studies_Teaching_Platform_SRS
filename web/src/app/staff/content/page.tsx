import { StaffCms } from "@/components/staff/staff-cms";
import { Container } from "@/components/ui/container";
import { requireStaffPage } from "@/server/rbac/guard";
import { listCmsWorkspace } from "@/server/staff/cms";

export const metadata = {
  title: "Content",
};

export default async function StaffContentPage() {
  const access = await requireStaffPage("cms.write");
  const workspace = await listCmsWorkspace({
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  });

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Content</h1>
      <p className="mt-2 max-w-2xl text-muted">
        CMS for landing pages, policies, FAQs, articles, announcements, and
        promotional banners. Drafts stay off the site until you publish them.
      </p>
      <div className="mt-8">
        <StaffCms initial={workspace} />
      </div>
    </Container>
  );
}
