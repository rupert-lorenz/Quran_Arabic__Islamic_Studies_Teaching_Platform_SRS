"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, patchJson, postJson } from "@/lib/api";
import { CMS_TYPES, cmsTypeLabel, type CmsDocumentType } from "@/lib/cms";
import { SeoFields } from "./seo-fields";
import { StaffFlash, StaffStat } from "./staff-stat";

type LocaleCopy = {
  locale: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

type DocumentRow = {
  id: string;
  type: CmsDocumentType;
  slug: string;
  status: string;
  pinned: boolean;
  sortOrder: number;
  href: string | null;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
  locales: LocaleCopy[];
};

export type CmsWorkspace = {
  locales: { code: string; name: string }[];
  types: { key: CmsDocumentType; label: string }[];
  summary: { total: number; published: number; draft: number; banners: number };
  documents: DocumentRow[];
};

function dateValue(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 16);
}

export function StaffCms({ initial }: { initial: CmsWorkspace }) {
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<CmsDocumentType | "all">("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const visible = useMemo(
    () =>
      data.documents.filter((item) => filter === "all" || item.type === filter),
    [data.documents, filter],
  );

  async function refresh() {
    setData(await getJson<CmsWorkspace>("/api/v1/staff/cms"));
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaffStat label="Documents" value={data.summary.total} />
        <StaffStat label="Published" value={data.summary.published} />
        <StaffStat label="Drafts" value={data.summary.draft} />
        <StaffStat label="Banners" value={data.summary.banners} />
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">
        Publish landing pages, policies, FAQs, articles, announcements, and
        banners. Public URLs stay unprefixed. Arabic and English share a slug;
        the visitor language cookie chooses the copy.
      </p>
      <StaffFlash error={error} message={message} />

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          className={`min-h-11 rounded-full px-4 text-sm font-bold ${
            filter === "all" ? "bg-brand text-white" : "bg-mint text-brand"
          }`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        {CMS_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`min-h-11 rounded-full px-4 text-sm font-bold ${
              filter === type ? "bg-brand text-white" : "bg-mint text-brand"
            }`}
            onClick={() => setFilter(type)}
          >
            {cmsTypeLabel(type)}
          </button>
        ))}
      </div>

      <form
        className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          setMessage("");
          const form = new FormData(event.currentTarget);
          try {
            await postJson("/api/v1/staff/cms", {
              type: String(form.get("type") ?? "page"),
              slug: String(form.get("slug") ?? ""),
              locale: String(form.get("locale") ?? "en"),
              title: String(form.get("title") ?? ""),
              excerpt: String(form.get("excerpt") ?? ""),
              body: String(form.get("body") ?? ""),
              seoTitle: String(form.get("seoTitle") ?? ""),
              seoDescription: String(form.get("seoDescription") ?? ""),
              ctaLabel: String(form.get("ctaLabel") ?? ""),
              ctaHref: String(form.get("ctaHref") ?? ""),
            });
            event.currentTarget.reset();
            await refresh();
            setMessage("Draft created.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="text-xl font-extrabold text-brand">New draft</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Type</span>
            <select name="type" className={fieldClass} defaultValue="page">
              {data.types.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Slug</span>
            <input name="slug" required className={fieldClass} placeholder="about" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Language</span>
            <select name="locale" className={fieldClass} defaultValue="en">
              {data.locales.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Title</span>
            <input name="title" required className={fieldClass} />
          </label>
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-bold text-brand">Excerpt</span>
          <input name="excerpt" className={fieldClass} />
        </label>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-bold text-brand">Body</span>
          <textarea name="body" rows={6} className={fieldClass} />
        </label>
        <div className="mt-4">
          <SeoFields />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Button label</span>
            <input name="ctaLabel" className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Button link</span>
            <input name="ctaHref" className={fieldClass} placeholder="/teachers" />
          </label>
        </div>
        <Button type="submit" className="mt-5" disabled={pending}>
          Create draft
        </Button>
      </form>

      <div className="mt-8 overflow-x-auto rounded-[2rem] border border-line bg-surface">
        <table className="min-w-full text-start text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-bold uppercase text-muted">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Languages</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((document) => (
              <tr key={document.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-bold text-brand">
                  {document.locales[0]?.title ?? document.slug}
                </td>
                <td className="px-4 py-3">{cmsTypeLabel(document.type)}</td>
                <td className="px-4 py-3">{document.slug}</td>
                <td className="px-4 py-3 capitalize">{document.status}</td>
                <td className="px-4 py-3">
                  {document.locales.map((item) => item.locale).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-end">
                  <div className="flex flex-wrap justify-end gap-2">
                    {document.href && document.status === "published" ? (
                      <Link
                        href={document.href}
                        className="inline-flex min-h-11 items-center font-bold text-brand underline"
                      >
                        View
                      </Link>
                    ) : null}
                    <Link
                      href={`/staff/content/${document.id}`}
                      className="inline-flex min-h-11 items-center font-bold text-brand underline"
                    >
                      Edit
                    </Link>
                    {document.status !== "published" ? (
                      <button
                        type="button"
                        className="min-h-11 font-bold text-brand underline"
                        disabled={pending}
                        onClick={async () => {
                          setPending(true);
                          setError("");
                          try {
                            await patchJson(`/api/v1/staff/cms/${document.id}`, {
                              status: "published",
                            });
                            await refresh();
                            setMessage("Published.");
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : "Could not publish",
                            );
                          } finally {
                            setPending(false);
                          }
                        }}
                      >
                        Publish
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="min-h-11 font-bold text-brand underline"
                        disabled={pending}
                        onClick={async () => {
                          setPending(true);
                          setError("");
                          try {
                            await patchJson(`/api/v1/staff/cms/${document.id}`, {
                              status: "draft",
                            });
                            await refresh();
                            setMessage("Moved to draft.");
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : "Could not update",
                            );
                          } finally {
                            setPending(false);
                          }
                        }}
                      >
                        Unpublish
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StaffCmsEditor({
  initial,
}: {
  initial: {
    locales: { code: string; name: string }[];
    types: { key: CmsDocumentType; label: string }[];
    document: DocumentRow;
  };
}) {
  const [document, setDocument] = useState(initial.document);
  const [locale, setLocale] = useState(
    initial.document.locales[0]?.locale ?? initial.locales[0]?.code ?? "en",
  );
  const copy =
    document.locales.find((item) => item.locale === locale) ??
    ({
      locale,
      title: "",
      excerpt: "",
      body: "",
      seoTitle: "",
      seoDescription: "",
      ctaLabel: "",
      ctaHref: "",
    } satisfies LocaleCopy);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        setMessage("");
        const form = new FormData(event.currentTarget);
        try {
          const saved = await patchJson<{ document: DocumentRow }>(
            `/api/v1/staff/cms/${document.id}`,
            {
              type: String(form.get("type") ?? document.type),
              slug: String(form.get("slug") ?? document.slug),
              status: String(form.get("status") ?? document.status),
              pinned: form.get("pinned") === "on",
              sortOrder: Number(form.get("sortOrder") ?? document.sortOrder),
              startsAt: String(form.get("startsAt") ?? ""),
              endsAt: String(form.get("endsAt") ?? ""),
              locale,
              title: String(form.get("title") ?? ""),
              excerpt: String(form.get("excerpt") ?? ""),
              body: String(form.get("body") ?? ""),
              seoTitle: String(form.get("seoTitle") ?? ""),
              seoDescription: String(form.get("seoDescription") ?? ""),
              ctaLabel: String(form.get("ctaLabel") ?? ""),
              ctaHref: String(form.get("ctaHref") ?? ""),
            },
          );
          setDocument(saved.document);
          setMessage("Saved.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save");
        } finally {
          setPending(false);
        }
      }}
    >
      <StaffFlash error={error} message={message} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Type</span>
          <select name="type" className={fieldClass} defaultValue={document.type}>
            {initial.types.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Slug</span>
          <input
            name="slug"
            required
            className={fieldClass}
            defaultValue={document.slug}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Status</span>
          <select name="status" className={fieldClass} defaultValue={document.status}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Sort</span>
          <input
            name="sortOrder"
            type="number"
            className={fieldClass}
            defaultValue={document.sortOrder}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Starts</span>
          <input
            name="startsAt"
            type="datetime-local"
            className={fieldClass}
            defaultValue={dateValue(document.startsAt)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Ends</span>
          <input
            name="endsAt"
            type="datetime-local"
            className={fieldClass}
            defaultValue={dateValue(document.endsAt)}
          />
        </label>
      </div>
      <label className="mt-4 inline-flex min-h-11 items-center gap-2 font-bold text-brand">
        <input type="checkbox" name="pinned" defaultChecked={document.pinned} />
        Pin to the top of lists and banners
      </label>

      <div className="mt-6 flex flex-wrap gap-2">
        {initial.locales.map((item) => (
          <button
            key={item.code}
            type="button"
            className={`min-h-11 rounded-full px-4 text-sm font-bold ${
              locale === item.code ? "bg-brand text-white" : "bg-mint text-brand"
            }`}
            onClick={() => setLocale(item.code)}
          >
            {item.name}
            {document.locales.some((copyItem) => copyItem.locale === item.code)
              ? ""
              : " · new"}
          </button>
        ))}
      </div>

      <label className="mt-5 block">
        <span className="mb-1 block text-sm font-bold text-brand">Title</span>
        <input
          key={`${locale}-title`}
          name="title"
          required
          className={fieldClass}
          defaultValue={copy.title}
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">Excerpt</span>
        <input
          key={`${locale}-excerpt`}
          name="excerpt"
          className={fieldClass}
          defaultValue={copy.excerpt ?? ""}
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">Body</span>
        <textarea
          key={`${locale}-body`}
          name="body"
          rows={10}
          className={fieldClass}
          defaultValue={copy.body ?? ""}
        />
      </label>
      <div className="mt-4">
        <SeoFields
          titleKey={`${locale}-seoTitle`}
          descriptionKey={`${locale}-seoDescription`}
          titleDefault={copy.seoTitle ?? ""}
          descriptionDefault={copy.seoDescription ?? ""}
          previewPath={document.href ?? `/pages/${document.slug}`}
        />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Button label</span>
          <input
            key={`${locale}-ctaLabel`}
            name="ctaLabel"
            className={fieldClass}
            defaultValue={copy.ctaLabel ?? ""}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Button link</span>
          <input
            key={`${locale}-ctaHref`}
            name="ctaHref"
            className={fieldClass}
            defaultValue={copy.ctaHref ?? ""}
          />
        </label>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          Save {locale.toUpperCase()}
        </Button>
        {document.href ? (
          <Link
            href={document.href}
            className="inline-flex min-h-11 items-center font-bold text-brand underline"
          >
            Open public URL
          </Link>
        ) : null}
      </div>
    </form>
  );
}
