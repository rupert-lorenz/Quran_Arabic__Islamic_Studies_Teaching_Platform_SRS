import { BrandMark } from "@/components/brand/brand-mark";
import { PublicShell } from "@/components/layout/public-shell";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getBrand } from "@/server/brand";

export default async function NotFound() {
  const brand = await getBrand();

  return (
    <PublicShell>
      <Container className="flex flex-col items-center py-20 text-center">
        <BrandMark size={64} />
        <h1 className="mt-8 text-3xl font-extrabold text-brand">
          This page is not on {brand.name}
        </h1>
        <p className="mt-3 max-w-md text-muted">
          The link may be outdated. Go back to the home page to find a teacher
          or open your account.
        </p>
        <ButtonLink href="/" className="mt-8">
          Back to {brand.name}
        </ButtonLink>
      </Container>
    </PublicShell>
  );
}
