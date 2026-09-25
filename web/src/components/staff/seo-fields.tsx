"use client";

import { useState } from "react";
import { fieldClass } from "@/lib/api";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from "@/lib/seo";

export function SeoFields({
  titleName = "seoTitle",
  descriptionName = "seoDescription",
  titleDefault = "",
  descriptionDefault = "",
  titleKey,
  descriptionKey,
  previewPath,
}: {
  titleName?: string;
  descriptionName?: string;
  titleDefault?: string;
  descriptionDefault?: string;
  titleKey?: string;
  descriptionKey?: string;
  previewPath?: string;
}) {
  const [title, setTitle] = useState(titleDefault);
  const [description, setDescription] = useState(descriptionDefault);
  const path = previewPath || "/pages/example";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-brand">SEO title</span>
        <input
          key={titleKey}
          name={titleName}
          className={fieldClass}
          defaultValue={titleDefault}
          maxLength={SEO_TITLE_MAX}
          onChange={(event) => setTitle(event.target.value)}
        />
        <span className="mt-1 block text-xs font-semibold text-muted">
          {title.length}/{SEO_TITLE_MAX}
        </span>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-brand">
          SEO description
        </span>
        <input
          key={descriptionKey}
          name={descriptionName}
          className={fieldClass}
          defaultValue={descriptionDefault}
          maxLength={SEO_DESCRIPTION_MAX}
          onChange={(event) => setDescription(event.target.value)}
        />
        <span className="mt-1 block text-xs font-semibold text-muted">
          {description.length}/{SEO_DESCRIPTION_MAX}
        </span>
      </label>
      <div className="rounded-[1.5rem] bg-mint/50 p-4 md:col-span-2">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-soft">
          Search preview
        </p>
        <p className="mt-2 text-lg font-bold text-[#1a0dab]">
          {title || "Page title"}
        </p>
        <p className="text-sm text-[#006621]">{path}</p>
        <p className="mt-1 text-sm text-muted">
          {description || "Add a short description for search results."}
        </p>
      </div>
    </div>
  );
}
