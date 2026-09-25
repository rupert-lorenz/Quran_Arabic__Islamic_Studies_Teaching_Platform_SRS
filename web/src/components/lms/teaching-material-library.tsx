"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { LibraryAccessPanel } from "@/components/lms/library-access-panel";
import { LibraryLicencesCard } from "@/components/lms/library-licences-card";
import { LibraryRentalsCard } from "@/components/lms/library-rentals-card";
import { LibraryPrerecordedCard } from "@/components/lms/library-prerecorded-card";
import { LibraryPurchasesCard } from "@/components/lms/library-purchases-card";
import { LibrarySubscriptionsCard } from "@/components/lms/library-subscriptions-card";
import { deleteJson, fieldClass, getJson, patchJson, postForm } from "@/lib/api";
import {
  defaultLibraryAudience,
  formatLibraryFileSize,
  libraryCategoryAccept,
  libraryFileHelpKey,
  LIBRARY_ACCESS_MODES,
  LIBRARY_ACTIVITY_CATEGORIES,
  LIBRARY_BOOK_CATEGORIES,
  LIBRARY_CATEGORY_LABEL,
  TEACHING_MATERIAL_AUDIENCES,
  TEACHING_MATERIAL_CATEGORIES,
  type LibraryAccessMode,
  type LibraryLockReason,
  type TeachingMaterialAudience,
  type TeachingMaterialCategory,
  type TeachingMaterialStatus,
} from "@/lib/library-materials";
import type { UiMessageKey } from "@/lib/i18n";
import type {
  LibraryAccessCatalog,
  LibraryAccessRuleView,
  LibraryGrantView,
} from "@/server/lms/entitlements";
import type { LearnerLicenceView } from "@/server/lms/licences";
import type { TeachingMaterialView } from "@/server/lms/library";
import type { LearnerRentalView } from "@/server/lms/rentals";
import type { LearnerPurchaseView } from "@/server/lms/purchases";
import type { PrerecordedCourseView } from "@/server/lms/prerecorded-courses";
import type { LearnerSubscriptionView } from "@/server/lms/subscriptions";

const categoryKeys = LIBRARY_CATEGORY_LABEL;

const statusKeys = {
  draft: "library.status.draft",
  published: "library.status.published",
  archived: "library.status.archived",
} as const satisfies Record<TeachingMaterialStatus, UiMessageKey>;

const audienceKeys = {
  learners: "library.audience.learners",
  teachers: "library.audience.teachers",
  staff: "library.audience.staff",
} as const satisfies Record<TeachingMaterialAudience, UiMessageKey>;

const accessKeys = {
  open: "library.access.open",
  entitled: "library.access.entitled",
} as const satisfies Record<LibraryAccessMode, UiMessageKey>;

const lockKeys = {
  course: "library.access.locked_course",
  subscription: "library.access.locked_subscription",
  licence: "library.access.locked_licence",
  rental: "library.access.locked_rental",
  purchase: "library.access.locked_purchase",
  contact: "library.access.locked_contact",
} as const satisfies Record<LibraryLockReason, UiMessageKey>;

function openLabel(item: TeachingMaterialView): UiMessageKey {
  if (item.category === "game") return "library.play";
  if (item.openKind === "audio") return "library.listen";
  if (item.openKind === "video") return "library.watch";
  if (item.category === "presentation") return "library.slides";
  if (item.category === "teacher_guide") return "library.open_guide";
  if (item.category === "worksheet") return "library.open_worksheet";
  if (item.category === "assessment") return "library.open_assessment";
  if (item.isBook) return "library.read";
  return "library.open";
}

export function TeachingMaterialLibrary({
  materials,
  subjects,
  catalog,
  licences,
  rentals,
  subscriptions,
  purchases,
  courses,
  canUpload,
  canManage,
}: {
  materials: TeachingMaterialView[];
  subjects: { slug: string; name: string }[];
  catalog?: LibraryAccessCatalog | null;
  licences?: LearnerLicenceView[];
  rentals?: LearnerRentalView[];
  subscriptions?: LearnerSubscriptionView[];
  purchases?: LearnerPurchaseView[];
  courses?: PrerecordedCourseView[];
  canUpload: boolean;
  canManage: boolean;
}) {
  const t = useT();
  const [items, setItems] = useState(materials);
  const [accessCatalog, setAccessCatalog] = useState(catalog ?? null);
  const [accessId, setAccessId] = useState<string | null>(null);
  const [accessRules, setAccessRules] = useState<LibraryAccessRuleView[]>([]);
  const [accessGrants, setAccessGrants] = useState<LibraryGrantView[]>([]);
  const [category, setCategory] = useState("");
  const [uploadCategory, setUploadCategory] = useState<TeachingMaterialCategory>(
    "quran_book",
  );
  const [subjectSlug, setSubjectSlug] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (category && item.category !== category) return false;
      if (subjectSlug && item.subjectSlug !== subjectSlug) return false;
      return true;
    });
  }, [items, category, subjectSlug]);

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const created = await postForm<TeachingMaterialView>(
        "/api/v1/library",
        body,
      );
      setItems((current) => [created, ...current]);
      form.reset();
      setMessage(t("library.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  async function openAccess(item: TeachingMaterialView) {
    if (accessId === item.id) {
      setAccessId(null);
      return;
    }
    setPending(true);
    setError("");
    try {
      const data = await getJson<{
        rules: LibraryAccessRuleView[];
        grants: LibraryGrantView[];
        catalog: LibraryAccessCatalog;
      }>(`/api/v1/library/${item.id}/entitlements`);
      setAccessRules(data.rules);
      setAccessGrants(data.grants);
      setAccessCatalog(data.catalog);
      setAccessId(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  async function setDownloadsRestricted(
    item: TeachingMaterialView,
    downloadsRestricted: boolean,
  ) {
    setPending(true);
    setError("");
    try {
      const next = await patchJson<TeachingMaterialView>(
        `/api/v1/library/${item.id}`,
        { downloadsRestricted },
      );
      setItems((current) =>
        current.map((row) => (row.id === next.id ? next : row)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  async function setAccessMode(item: TeachingMaterialView, accessMode: LibraryAccessMode) {
    setPending(true);
    setError("");
    try {
      const next = await patchJson<TeachingMaterialView>(
        `/api/v1/library/${item.id}`,
        { accessMode },
      );
      setItems((current) =>
        current.map((row) => (row.id === next.id ? next : row)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  async function setStatus(item: TeachingMaterialView, status: TeachingMaterialStatus) {
    setPending(true);
    setError("");
    try {
      const next = await patchJson<TeachingMaterialView>(
        `/api/v1/library/${item.id}`,
        { status },
      );
      setItems((current) =>
        current.map((row) => (row.id === next.id ? next : row)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  async function remove(item: TeachingMaterialView) {
    setPending(true);
    setError("");
    try {
      await deleteJson(`/api/v1/library/${item.id}`);
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("library.title")}
      </h2>
      <p className="mt-2 text-sm font-semibold text-muted">{t("library.help")}</p>
      <LibraryPrerecordedCard courses={courses ?? []} />
      <LibraryLicencesCard licences={licences ?? []} />
      <LibraryRentalsCard rentals={rentals ?? []} />
      <LibrarySubscriptionsCard subscriptions={subscriptions ?? []} />
      <LibraryPurchasesCard purchases={purchases ?? []} />

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {LIBRARY_BOOK_CATEGORIES.map((shelf) => {
          const count = items.filter((item) => item.category === shelf).length;
          const active = category === shelf;
          return (
            <button
              key={shelf}
              type="button"
              onClick={() => setCategory(active ? "" : shelf)}
              className={`rounded-2xl px-4 py-4 text-start ${
                active ? "bg-brand text-white" : "bg-mint text-brand"
              }`}
            >
              <p className="font-heading font-bold tracking-tight">
                {t(categoryKeys[shelf])}
              </p>
              <p className={`mt-1 text-sm font-semibold ${active ? "text-white/80" : "text-muted"}`}>
                {t("library.shelf_count", { count })}
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {LIBRARY_ACTIVITY_CATEGORIES.map((shelf) => {
          const count = items.filter((item) => item.category === shelf).length;
          const active = category === shelf;
          return (
            <button
              key={shelf}
              type="button"
              onClick={() => setCategory(active ? "" : shelf)}
              className={`rounded-2xl px-4 py-4 text-start ${
                active ? "bg-brand text-white" : "bg-mint text-brand"
              }`}
            >
              <p className="font-heading font-bold tracking-tight">
                {t(categoryKeys[shelf])}
              </p>
              <p className={`mt-1 text-sm font-semibold ${active ? "text-white/80" : "text-muted"}`}>
                {t("library.item_count", { count })}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            {t("library.filter_category")}
          </span>
          <select
            className={fieldClass}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{t("library.all_categories")}</option>
            {TEACHING_MATERIAL_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {t(categoryKeys[value])}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            {t("library.filter_subject")}
          </span>
          <select
            className={fieldClass}
            value={subjectSlug}
            onChange={(event) => setSubjectSlug(event.target.value)}
          >
            <option value="">{t("library.all_subjects")}</option>
            {subjects.map((subject) => (
              <option key={subject.slug} value={subject.slug}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {canUpload ? (
        <form
          className="mt-6 rounded-2xl bg-mint p-4"
          onSubmit={onUpload}
        >
          <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
            {t("library.add")}
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("library.material_title")}
              </span>
              <input name="title" required minLength={2} className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("library.category")}
              </span>
              <select
                name="category"
                required
                className={fieldClass}
                value={uploadCategory}
                onChange={(event) =>
                  setUploadCategory(event.target.value as TeachingMaterialCategory)
                }
              >
                {TEACHING_MATERIAL_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {t(categoryKeys[value])}
                  </option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("library.description")}
              </span>
              <input name="description" className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("library.subject")}
              </span>
              <select name="subjectSlug" className={fieldClass} defaultValue="">
                <option value="">{t("library.any_subject")}</option>
                {subjects.map((subject) => (
                  <option key={subject.slug} value={subject.slug}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("library.audience")}
              </span>
              <select
                key={uploadCategory}
                name="audience"
                className={fieldClass}
                defaultValue={defaultLibraryAudience(uploadCategory)}
              >
                {TEACHING_MATERIAL_AUDIENCES.filter((value) => {
                  if (!canManage && value === "staff") return false;
                  if (uploadCategory === "teacher_guide" && value === "learners") {
                    return false;
                  }
                  return true;
                }).map((value) => (
                  <option key={value} value={value}>
                    {t(audienceKeys[value])}
                  </option>
                ))}
              </select>
            </label>
            {canManage ? (
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-brand">
                  {t("library.access.mode")}
                </span>
                <select name="accessMode" className={fieldClass} defaultValue="open">
                  {LIBRARY_ACCESS_MODES.map((value) => (
                    <option key={value} value={value}>
                      {t(accessKeys[value])}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex items-center gap-3 pt-6">
              <input
                name="downloadsRestricted"
                type="checkbox"
                value="true"
                className="h-5 w-5 accent-brand"
              />
              <span className="text-sm font-bold text-brand">
                {t("library.downloads.restrict")}
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("library.status")}
              </span>
              <select name="status" className={fieldClass} defaultValue="draft">
                <option value="draft">{t("library.status.draft")}</option>
                <option value="published">{t("library.status.published")}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("library.file")}
              </span>
              <input
                name="file"
                type="file"
                required
                accept={libraryCategoryAccept(uploadCategory)}
                className={fieldClass}
              />
              <span className="mt-1 block text-xs font-semibold text-muted">
                {t(libraryFileHelpKey(uploadCategory))}
              </span>
              {uploadCategory === "teacher_guide" ? (
                <span className="mt-1 block text-xs font-semibold text-muted">
                  {t("library.guide_only")}
                </span>
              ) : null}
            </label>
          </div>
          <Button type="submit" className="mt-4" disabled={pending}>
            {pending ? t("booking.saving") : t("library.upload")}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm font-semibold text-brand">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm font-semibold text-brand">{message}</p>
      ) : null}

      {visible.length ? (
        <ul className="mt-6 grid gap-3">
          {visible.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl bg-background px-4 py-4 text-sm font-semibold text-brand"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-bold tracking-tight">{item.title}</p>
                  <p className="mt-1 text-muted">
                    {t(categoryKeys[item.category])}
                    {item.subjectName ? ` · ${item.subjectName}` : ""}
                    {item.pageCount
                      ? ` · ${t("library.pages", { count: item.pageCount })}`
                      : ""}
                    {` · ${t(accessKeys[item.accessMode])}`}
                    {` · ${
                      item.downloadsRestricted
                        ? t("library.downloads.restricted")
                        : t("library.downloads.allowed")
                    }`}
                    {` · ${t(statusKeys[item.status])}`}
                    {` · ${t(audienceKeys[item.audience])}`}
                    {` · ${formatLibraryFileSize(item.byteSize)}`}
                  </p>
                  {item.description ? (
                    <p className="mt-1 text-muted">{item.description}</p>
                  ) : null}
                  {item.isLocked ? (
                    <p className="mt-2 text-sm font-semibold text-muted">
                      {t(lockKeys[item.lockReason ?? "contact"])}
                    </p>
                  ) : null}
                  {!item.isLocked && item.downloadsRestricted && !item.canDownload ? (
                    <p className="mt-2 text-sm font-semibold text-muted">
                      {t("library.downloads.view_only")}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.isLocked ? (
                    <span className="inline-flex min-h-11 items-center rounded-full bg-mint px-4 text-sm font-bold text-brand">
                      {t("library.access.locked")}
                    </span>
                  ) : item.canOpen ? (
                    <a
                      href={item.readHref}
                      className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-sm font-bold text-white"
                    >
                      {t(openLabel(item))}
                    </a>
                  ) : item.canDownload ? (
                    <a
                      href={item.downloadHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-sm font-bold text-white"
                    >
                      {t("library.open")}
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center rounded-full bg-mint px-4 text-sm font-bold text-brand">
                      {t("library.downloads.view_only")}
                    </span>
                  )}
                  {!item.isLocked && item.canDownload ? (
                    <a
                      href={item.downloadHref}
                      download={item.originalName}
                      className="inline-flex min-h-11 items-center rounded-full bg-gold px-4 text-sm font-bold text-brand"
                    >
                      {t("library.download")}
                    </a>
                  ) : null}
                  {item.canEdit ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        void setDownloadsRestricted(
                          item,
                          !item.downloadsRestricted,
                        )
                      }
                    >
                      {item.downloadsRestricted
                        ? t("library.downloads.allow")
                        : t("library.downloads.restrict")}
                    </Button>
                  ) : null}
                  {canManage ? (
                    <>
                      <select
                        className={fieldClass}
                        value={item.accessMode}
                        disabled={pending}
                        onChange={(event) => {
                          void setAccessMode(
                            item,
                            event.target.value as LibraryAccessMode,
                          );
                        }}
                      >
                        {LIBRARY_ACCESS_MODES.map((value) => (
                          <option key={value} value={value}>
                            {t(accessKeys[value])}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          void openAccess(item);
                        }}
                      >
                        {t("library.access.manage")}
                      </Button>
                    </>
                  ) : null}
                  {item.canEdit ? (
                    <>
                      {item.status !== "published" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => setStatus(item, "published")}
                        >
                          {t("library.publish")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => setStatus(item, "archived")}
                        >
                          {t("library.archive")}
                        </Button>
                      )}
                      {item.status === "archived" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => setStatus(item, "draft")}
                        >
                          {t("library.status.draft")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => remove(item)}
                      >
                        {t("library.remove")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              {canManage && accessId === item.id && accessCatalog ? (
                <LibraryAccessPanel
                  materialId={item.id}
                  catalog={accessCatalog}
                  rules={accessRules}
                  grants={accessGrants}
                  onChange={(next) => {
                    setAccessRules(next.rules);
                    setAccessGrants(next.grants);
                    setAccessCatalog(next.catalog);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">{t("library.none")}</p>
      )}
    </section>
  );
}
