import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffCmsEditor } from "@/components/staff/staff-cms";
import { Container } from "@/components/ui/container";
import { isApiError } from "@/server/api/errors";
import { requireStaffPage } from "@/server/rbac/guard";
import { getCmsDocument } from "@/server/staff/cms";

export const metadata = {
  title: "Edit content",
};

export default async function StaffContentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireStaffPage("cms.write");
  let workspace;
  try {
    workspace = await getCmsDocument(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      id,
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <Container className="py-10">
      <p className="text-sm font-bold">
        <Link href="/staff/content" className="text-brand underline">
          Back to content
        </Link>
      </p>
      <h1 className="mt-3 text-3xl font-extrabold text-brand">
        {workspace.document.locales[0]?.title ?? workspace.document.slug}
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Save each language separately. The same public URL serves every locale.
      </p>
      <div className="mt-8">
        <StaffCmsEditor initial={workspace} />
      </div>
    </Container>
  );
}
