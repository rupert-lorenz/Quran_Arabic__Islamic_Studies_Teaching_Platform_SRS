"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, putJson } from "@/lib/api";
import {
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  type SiteSeo,
} from "@/lib/seo";
import { StaffFlash } from "./staff-stat";

export function StaffSeo({ initial }: { initial: SiteSeo }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="rounded-[2rem] border border-line bg-surface p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        setMessage("");
        try {
          const next = await putJson<SiteSeo>("/api/v1/staff/seo", {
            defaultTitle: String(form.get("defaultTitle") ?? ""),
            defaultDescription: String(form.get("defaultDescription") ?? ""),
            robotsIndex: form.get("robotsIndex") === "on",
          });
          setData(next);
          setMessage("SEO settings saved.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save");
        } finally {
          setPending(false);
        }
      }}
    >
      <StaffFlash error={error} message={message} />
      <p className="text-sm leading-6 text-muted">
        Titles and descriptions on CMS pages still come from each document.
        These defaults fill the homepage tab title and the site-wide fallback
        description. Clean public URLs stay unprefixed slugs:{" "}
        <code className="font-semibold text-brand">/subjects/quran</code>,{" "}
        <code className="font-semibold text-brand">/courses/quran</code>,{" "}
        <code className="font-semibold text-brand">/pages/welcome</code>,{" "}
        <code className="font-semibold text-brand">/policies/privacy</code>.
        Teacher profiles keep a stable UUID path.
      </p>
      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-bold text-brand">
          Default title
        </span>
        <input
          name="defaultTitle"
          className={fieldClass}
          defaultValue={data.defaultTitle}
          maxLength={SEO_TITLE_MAX}
          placeholder="Leave blank to use the brand name"
        />
        <span className="mt-1 block text-xs font-semibold text-muted">
          Up to {SEO_TITLE_MAX} characters. Used as the homepage title.
        </span>
      </label>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">
          Default description
        </span>
        <textarea
          name="defaultDescription"
          rows={3}
          className={fieldClass}
          defaultValue={data.defaultDescription}
          maxLength={SEO_DESCRIPTION_MAX}
          placeholder="Leave blank to use the brand description"
        />
        <span className="mt-1 block text-xs font-semibold text-muted">
          Up to {SEO_DESCRIPTION_MAX} characters. Search engines show this when
          a page has no specific description.
        </span>
      </label>
      <label className="mt-5 flex items-start gap-3">
        <input
          type="checkbox"
          name="robotsIndex"
          defaultChecked={data.robotsIndex}
          className="mt-1 h-5 w-5 accent-[var(--brand)]"
        />
        <span>
          <span className="block text-sm font-bold text-brand">
            Allow search engines to index public pages
          </span>
          <span className="mt-1 block text-sm text-muted">
            Turn this off on staging. It sets noindex, empties the sitemap, and
            disallows crawlers in robots.txt. Login and account URLs stay
            noindex either way.
          </span>
        </span>
      </label>
      <Button type="submit" className="mt-6" disabled={pending}>
        Save SEO settings
      </Button>
    </form>
  );
}
