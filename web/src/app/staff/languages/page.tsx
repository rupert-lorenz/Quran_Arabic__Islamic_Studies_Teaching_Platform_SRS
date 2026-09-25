import { StaffLanguages } from "@/components/staff/staff-languages";
import { Container } from "@/components/ui/container";
import { requireStaffPage } from "@/server/rbac/guard";
import { listI18nWorkspace } from "@/server/staff/i18n";

export const metadata = {
  title: "Languages",
};

export default async function StaffLanguagesPage() {
  const access = await requireStaffPage(["settings.write", "cms.write"]);
  const workspace = await listI18nWorkspace({
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  });

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Languages</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Enable locales, set RTL, and translate public chrome and subject names.
        Routes stay unprefixed — language follows the visitor cookie, then the
        signed-in account, then the browser.
      </p>
      <div className="mt-8">
        <StaffLanguages initial={workspace} />
      </div>
    </Container>
  );
}
