import { isCmsBulletBlock, splitCmsBlocks } from "@/lib/cms";

export function CmsBody({
  body,
  className = "mt-6 space-y-5 text-lg leading-8 text-muted",
}: {
  body?: string | null;
  className?: string;
}) {
  const blocks = splitCmsBlocks(body);
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {blocks.map((block) =>
        isCmsBulletBlock(block) ? (
          <ul key={block} className="grid gap-3 md:grid-cols-2">
            {block
              .split("\n")
              .map((line) => line.replace(/^-+\s*/, "").trim())
              .filter(Boolean)
              .map((item) => (
                <li
                  key={item}
                  className="rounded-[var(--radius-card)] border border-line bg-surface px-5 py-5 font-bold text-brand"
                >
                  {item}
                </li>
              ))}
          </ul>
        ) : (
          <p key={block}>{block}</p>
        ),
      )}
    </div>
  );
}
