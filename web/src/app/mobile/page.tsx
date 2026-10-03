import Link from "next/link";
import { redirect } from "next/navigation";
import { MobileFacultiesView } from "@/components/mobile/mobile-faculties";
import { RegisterBrowser } from "@/components/mobile/register-browser";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getMobileFaculties } from "@/server/mobile/faculties";
import { getI18n } from "@/server/i18n/locale";
import { getAccessContext } from "@/server/rbac/guard";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("mb.page.title"), description: t("mb.page.help") };
}

export default async function MobilePage() {
  const [{ t }, access] = await Promise.all([getI18n(), getAccessContext()]);
  if (access?.twoFactorPending) redirect("/account/security");

  const faculties = access
    ? await getMobileFaculties({
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      })
    : null;

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("mb.page.title")}
        title={t("mb.page.title")}
        description={t("mb.page.help")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: t("mb.page.title") },
          ]}
        />
      </PageHero>
      <Container className="space-y-8 py-10">
        {faculties ? (
          <>
            <RegisterBrowser />
            <MobileFacultiesView faculties={faculties} />
          </>
        ) : (
          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
              {t("mb.page.signInTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {t("mb.page.scope")}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {t("mb.page.signInHelp")}
            </p>
            <ul className="mt-4 grid gap-2 text-sm text-brand sm:grid-cols-2">
              {(
                [
                  "mb.ios.title",
                  "mb.android.title",
                  "mb.login.title",
                  "mb.search.title",
                  "mb.book.title",
                  "mb.pay.title",
                  "mb.class.title",
                  "mb.msg.title",
                  "mb.hw.title",
                  "mb.rep.title",
                  "mb.prog.title",
                  "mb.note.title",
                  "mb.rec.title",
                  "mb.lib.title",
                  "mb.push.title",
                ] as const
              ).map((key) => (
                <li key={key} className="rounded-2xl bg-mint px-4 py-3 font-bold">
                  {t(key)}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-full bg-brand-accent px-5 py-2 text-sm font-bold text-brand"
            >
              {t("nav.login")}
            </Link>
          </section>
        )}
      </Container>
    </PublicShell>
  );
}
