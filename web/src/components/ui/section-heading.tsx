export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-extrabold tracking-[0.18em] text-brand-accent uppercase">
        {eyebrow}
      </p>
      <h2 className="font-heading mt-3 text-[clamp(1.6rem,2.5vw+0.8rem,2.35rem)] font-bold tracking-tight text-pretty text-brand">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-7 text-muted sm:text-lg sm:leading-8">{description}</p>
      ) : null}
    </div>
  );
}
