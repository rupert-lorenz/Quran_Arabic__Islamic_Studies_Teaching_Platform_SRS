import { HandoverFacultiesView } from "@/components/handover/handover-faculties";
import { Container } from "@/components/ui/container";
import { getHandoverFaculties } from "@/server/handover/faculties";
import { getI18n } from "@/server/i18n/locale";
import { requireStaffPage } from "@/server/rbac/guard";
import Link from "next/link";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("ho.page.title"), description: t("ho.page.help") };
}

export default async function StaffHandoverPage() {
  const { t } = await getI18n();
  await requireStaffPage();
  const faculties = await getHandoverFaculties();

  return (
    <Container className="space-y-8 py-10">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-brand">
          {t("ho.page.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("ho.page.help")}</p>
      </div>
      <HandoverFacultiesView faculties={faculties} />
      <p className="text-sm">
        <Link href="/staff" className="font-bold text-brand-accent underline">
          {t("dc.back.staff")}
        </Link>
      </p>
    </Container>
  );
}
