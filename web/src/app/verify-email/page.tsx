import { VerifyEmailClient } from "@/components/auth/verify-email-client";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";

import { pageMetadata } from "@/server/cms/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "Verify email",
    description: "Confirm your email address to activate your account.",
    path: "/verify-email",
    index: false,
  });
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const { t } = await getI18n();

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("auth.verify_eyebrow")}
        title={t("auth.verify_title")}
        description={t("auth.verify_description")}
      />
      <Container className="py-10">
        <VerifyEmailClient token={token ?? ""} />
      </Container>
    </PublicShell>
  );
}
