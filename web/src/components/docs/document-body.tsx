export function DocumentBody({
  title,
  help,
  blocks,
}: {
  title: string;
  help: string;
  blocks: { heading: string; paragraphs: string[]; items?: string[] }[];
}) {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-brand">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{help}</p>
      </header>
      {blocks.map((block) => (
        <section key={block.heading}>
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">{block.heading}</h2>
          {block.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {paragraph}
            </p>
          ))}
          {block.items?.length ? (
            <ul className="mt-3 max-w-2xl list-disc space-y-2 ps-5 text-sm leading-6 text-muted">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </article>
  );
}
