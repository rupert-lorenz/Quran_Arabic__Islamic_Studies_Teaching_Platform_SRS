"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { postJson } from "@/lib/api";
import { LIBRARY_CATEGORY_LABEL } from "@/lib/library-materials";
import type { LibraryDownloadDesk } from "@/server/lms/downloads";

export function LibraryDownloadsPanel({
  initial,
}: {
  initial: LibraryDownloadDesk;
}) {
  const t = useT();
  const [desk, setDesk] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function setRestricted(materialId: string, downloadsRestricted: boolean) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<LibraryDownloadDesk>(
        "/api/v1/library/downloads",
        { materialId, downloadsRestricted },
      );
      setDesk(next);
      setMessage(t("library.downloads.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("library.downloads.title")}
      </h2>
      <p className="mt-2 text-sm font-semibold text-muted">
        {t("library.downloads.help")}
      </p>

      {desk.materials.length ? (
        <ul className="mt-6 grid gap-3">
          {desk.materials.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-background px-4 py-3"
            >
              <div>
                <p className="font-heading font-bold tracking-tight text-brand">
                  {item.title}
                </p>
                <p className="mt-1 text-sm font-semibold text-muted">
                  {t(LIBRARY_CATEGORY_LABEL[item.category])}
                  {` · `}
                  {item.downloadsRestricted
                    ? t("library.downloads.restricted")
                    : t("library.downloads.allowed")}
                </p>
              </div>
              <Button
                type="button"
                variant={item.downloadsRestricted ? "secondary" : "primary"}
                disabled={pending}
                onClick={() =>
                  void setRestricted(item.id, !item.downloadsRestricted)
                }
              >
                {item.downloadsRestricted
                  ? t("library.downloads.allow")
                  : t("library.downloads.restrict")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">
          {t("library.downloads.none")}
        </p>
      )}

      {error ? <p className="mt-4 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? (
        <p className="mt-4 text-sm font-semibold text-brand">{message}</p>
      ) : null}
    </section>
  );
}
