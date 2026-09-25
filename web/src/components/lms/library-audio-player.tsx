"use client";

import { useT } from "@/components/i18n/i18n-provider";
import { LIBRARY_CATEGORY_LABEL } from "@/lib/library-materials";
import type { TeachingBookView } from "@/server/lms/library";

export function LibraryAudioPlayer({
  item,
  onEnded,
}: {
  item: TeachingBookView;
  onEnded?: () => void;
}) {
  const t = useT();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6">
      <p className="font-heading text-sm font-bold tracking-tight text-brand">
        {t(LIBRARY_CATEGORY_LABEL[item.category])}
        {item.subjectName ? ` · ${item.subjectName}` : ""}
      </p>
      <audio
        className="mt-4 w-full"
        src={item.href}
        controls
        preload="metadata"
        onEnded={onEnded}
      />
      {item.canDownload ? (
        <p className="mt-4">
          <a
            href={item.downloadHref}
            download={item.originalName}
            className="inline-flex min-h-11 items-center rounded-full bg-gold px-4 text-sm font-bold text-brand"
          >
            {t("library.download")}
          </a>
        </p>
      ) : item.downloadsRestricted ? (
        <p className="mt-4 text-sm font-semibold text-muted">
          {t("library.downloads.view_only")}
        </p>
      ) : null}
    </section>
  );
}
