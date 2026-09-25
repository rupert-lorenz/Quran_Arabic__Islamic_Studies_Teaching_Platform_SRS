"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import type { ClassroomPresentation } from "@/db/schema/classrooms";
import { classroomFileHref } from "@/lib/classroom-files";

export const CLASSROOM_ZOOM_STEPS = [100, 125, 150, 175, 200] as const;
export const CLASSROOM_ZOOM_DEFAULT = 100;

export function stepClassroomZoom(percent: number, direction: 1 | -1) {
  const index = CLASSROOM_ZOOM_STEPS.findIndex((step) => step >= percent);
  const current = index < 0 ? CLASSROOM_ZOOM_STEPS.length - 1 : index;
  const next = Math.max(0, Math.min(CLASSROOM_ZOOM_STEPS.length - 1, current + direction));
  if (direction < 0 && CLASSROOM_ZOOM_STEPS[current] > percent) {
    return CLASSROOM_ZOOM_STEPS[current];
  }
  return CLASSROOM_ZOOM_STEPS[next];
}

export function ClassroomReaderToolbar({
  current,
  total,
  zoom,
  fullscreen,
  thumbsOpen,
  bookmarked,
  canBookmark,
  canPresent,
  canJump,
  onJump,
  onZoom,
  onFullscreen,
  onBookmark,
  onThumbs,
}: {
  current: number;
  total: number;
  zoom: number;
  fullscreen: boolean;
  thumbsOpen: boolean;
  bookmarked: boolean;
  canBookmark: boolean;
  canPresent: boolean;
  canJump: boolean;
  onJump: (slideIndex: number) => void;
  onZoom: (percent: number) => void;
  onFullscreen: () => void;
  onBookmark: () => void;
  onThumbs: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(String(current));
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(String(current));
  }, [current]);

  function commitJump() {
    const next = Number.parseInt(draft, 10);
    if (!Number.isFinite(next)) {
      setDraft(String(current));
      return;
    }
    onJump(next - 1);
    setDraft(String(Math.max(1, Math.min(total, next))));
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {canJump ? (
        <form
          className="flex items-center gap-1 rounded-full border border-brand/15 bg-background px-3 py-1"
          onSubmit={(event) => {
            event.preventDefault();
            commitJump();
          }}
        >
          <label className="flex items-center gap-1">
            <span className="sr-only">{t("classroom.page_go")}</span>
            <input
              type="text"
              inputMode="numeric"
              value={draft}
              aria-label={t("classroom.page_go")}
              className="w-10 bg-transparent text-center text-sm font-bold text-brand outline-none"
              onFocus={() => {
                editing.current = true;
              }}
              onBlur={() => {
                editing.current = false;
                commitJump();
              }}
              onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
            />
          </label>
          <span className="text-xs font-semibold text-muted">/ {total}</span>
        </form>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={zoom <= CLASSROOM_ZOOM_STEPS[0]}
        onClick={() => onZoom(stepClassroomZoom(zoom, -1))}
      >
        {t("classroom.zoom_out")}
      </Button>
      <span className="text-xs font-bold text-brand">{t("classroom.zoom_of", { percent: zoom })}</span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={zoom >= CLASSROOM_ZOOM_STEPS[CLASSROOM_ZOOM_STEPS.length - 1]}
        onClick={() => onZoom(stepClassroomZoom(zoom, 1))}
      >
        {t("classroom.zoom_in")}
      </Button>
      {zoom !== CLASSROOM_ZOOM_DEFAULT ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => onZoom(CLASSROOM_ZOOM_DEFAULT)}>
          {t("classroom.zoom_reset")}
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="secondary" onClick={onFullscreen}>
        {fullscreen ? t("classroom.fullscreen_exit") : t("classroom.fullscreen")}
      </Button>
      {canPresent ? (
        <Button
          type="button"
          size="sm"
          variant={bookmarked ? "primary" : "secondary"}
          disabled={!bookmarked && !canBookmark}
          onClick={onBookmark}
        >
          {bookmarked ? t("classroom.bookmark_remove") : t("classroom.bookmark")}
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" onClick={onThumbs}>
        {thumbsOpen ? t("classroom.thumbs_hide") : t("classroom.thumbs_show")}
      </Button>
    </div>
  );
}

export function ClassroomPageSync({
  following,
  locked,
  viewIndex,
  classIndex,
  total,
  canPresent,
  onFollow,
  onLock,
}: {
  following: boolean;
  locked: boolean;
  viewIndex: number;
  classIndex: number;
  total: number;
  canPresent: boolean;
  onFollow: () => void;
  onLock: (locked: boolean) => void;
}) {
  const t = useT();
  const inSync = following || locked || viewIndex === classIndex;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span
        className={`rounded-full px-3 py-1 text-xs font-extrabold ${
          inSync ? "bg-mint text-brand" : "bg-gold text-brand"
        }`}
      >
        {canPresent
          ? locked
            ? t("classroom.sync_class")
            : t("classroom.sync_open")
          : locked || following
            ? t("classroom.sync_on", { current: classIndex + 1, total })
            : t("classroom.sync_off", {
                view: viewIndex + 1,
                class: classIndex + 1,
              })}
      </span>
      {canPresent ? (
        <Button
          type="button"
          size="sm"
          variant={locked ? "secondary" : "ghost"}
          aria-pressed={locked}
          onClick={() => onLock(!locked)}
        >
          {locked ? t("classroom.sync_unlock") : t("classroom.sync_lock")}
        </Button>
      ) : !locked && !following ? (
        <Button type="button" size="sm" variant="primary" onClick={onFollow}>
          {t("classroom.sync_follow")}
        </Button>
      ) : null}
    </div>
  );
}

export function ClassroomThumbnails({
  deck,
  classroomId,
  canTurn,
  open,
  viewIndex,
  classIndex,
  onTurn,
}: {
  deck: ClassroomPresentation;
  classroomId: string;
  canTurn: boolean;
  open: boolean;
  viewIndex: number;
  classIndex: number;
  onTurn: (slideIndex: number) => void;
}) {
  const t = useT();
  const book = deck.kind === "pdf" || deck.kind === "epub";
  const bookmarks = new Set(deck.bookmarks ?? []);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scroller.current;
    if (!root || !open) return;
    const current = root.querySelector<HTMLElement>("[data-current='true']");
    if (!current) return;
    const left = current.offsetLeft - root.clientWidth / 2 + current.offsetWidth / 2;
    root.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [open, viewIndex]);

  if (!open) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-extrabold uppercase tracking-wide text-brand-soft">
        {t("classroom.thumbs")}
      </p>
      <div ref={scroller} className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {deck.slides.map((slide, index) => {
          const current = index === viewIndex;
          const teacherPage = index === classIndex;
          const marked = bookmarks.has(index);
          const label = book
            ? t("classroom.thumb_page", { n: index + 1 })
            : t("classroom.thumb_slide", { n: index + 1 });
          const inner = (
            <>
              {slide.imageFileId ? (
                // Classroom page thumbnails are session-authenticated file bytes.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={classroomFileHref(classroomId, slide.imageFileId)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[#FBF7EF] px-1 text-center text-[0.6rem] font-bold leading-tight text-brand">
                  {slide.title.slice(0, 28) || label}
                </span>
              )}
              {teacherPage && !current ? (
                <span className="absolute inset-x-0 top-0 h-1 bg-brand" />
              ) : null}
              {marked ? (
                <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-brand-accent" />
              ) : null}
              <span className="absolute inset-x-0 bottom-0 bg-brand/75 py-0.5 text-center text-[0.6rem] font-extrabold text-white">
                {index + 1}
              </span>
            </>
          );
          const className = `relative h-20 w-14 shrink-0 overflow-hidden rounded-md border ${
            current ? "border-brand-accent ring-2 ring-brand-accent" : "border-line"
          }`;
          return canTurn ? (
            <button
              key={slide.id}
              type="button"
              data-current={current ? "true" : undefined}
              aria-current={current ? "page" : undefined}
              aria-label={marked ? `${label} · ${t("classroom.bookmark")}` : label}
              className={className}
              onClick={() => onTurn(index)}
            >
              {inner}
            </button>
          ) : (
            <div
              key={slide.id}
              data-current={current ? "true" : undefined}
              aria-current={current ? "page" : undefined}
              className={className}
            >
              {inner}
            </div>
          );
        })}
      </div>
      {(deck.bookmarks?.length ?? 0) > 0 && canTurn ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="text-xs font-extrabold uppercase text-brand-soft">
            {t("classroom.bookmarks")}
          </span>
          {deck.bookmarks?.map((index) => (
            <Button
              key={index}
              type="button"
              size="sm"
              variant={index === viewIndex ? "primary" : "secondary"}
              onClick={() => onTurn(index)}
            >
              {book
                ? t("classroom.thumb_page", { n: index + 1 })
                : t("classroom.thumb_slide", { n: index + 1 })}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
