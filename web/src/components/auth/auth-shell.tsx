import { BrandMark } from "@/components/brand/brand-mark";
import { Container } from "@/components/ui/container";
import type { BrandProfile } from "@/lib/brand";

export function AuthShell({
  brand,
  children,
}: {
  brand: BrandProfile;
  children: React.ReactNode;
}) {
  return (
    <div className="grid lg:min-h-[calc(100dvh-8rem)] lg:grid-cols-2">
      <aside className="logo-hang-band relative hidden overflow-hidden bg-brand px-10 pb-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <BrandMark size={56} tone="inverse" />
          <p className="mt-8 text-sm font-extrabold tracking-[0.18em] text-brand-accent uppercase">
            {brand.tagline}
          </p>
          <h2 className="font-heading mt-4 max-w-md text-4xl font-bold tracking-tight">
            {brand.name}
          </h2>
          {brand.nameAr !== brand.name ? (
            <p className="mt-3 text-xl font-semibold text-white/80">{brand.nameAr}</p>
          ) : null}
          <p className="mt-6 max-w-md text-sm leading-7 text-white/70">
            {brand.description}
          </p>
        </div>
        <p className="text-sm font-semibold text-brand-accent">{brand.taglineAr}</p>
      </aside>
      <Container className="logo-hang-band flex flex-col justify-center pb-12 sm:pb-16">
        <div className="mb-6 lg:hidden">
          <BrandMark size={44} />
        </div>
        {children}
      </Container>
    </div>
  );
}
