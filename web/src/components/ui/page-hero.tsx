import { Container } from "./container";

export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="page-hero border-b border-line bg-mint/70">
      <Container className="logo-hang-band pb-8 pt-8 sm:pb-12 sm:pt-10 md:pb-16 md:pt-12">
        {children}
        <p className="text-sm font-extrabold tracking-[0.18em] text-brand-accent uppercase">
          {eyebrow}
        </p>
        <h1 className="font-heading mt-3 max-w-3xl text-[clamp(1.85rem,4vw+0.8rem,3.25rem)] font-bold tracking-tight text-brand text-pretty">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
          {description}
        </p>
      </Container>
    </section>
  );
}
