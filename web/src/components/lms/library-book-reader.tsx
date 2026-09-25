"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  ClassroomFlipbook,
  ClassroomFlipbookHits,
} from "@/components/classroom/classroom-flipbook";
import {
  CLASSROOM_ZOOM_DEFAULT,
  ClassroomReaderToolbar,
} from "@/components/classroom/classroom-reader";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { CLASSROOM_MAX_BOOKMARKS } from "@/lib/classroom-pptx";
import {
  readLibraryBookmarks,
  subscribeLibraryBookmarks,
  toggleLibraryBookmark,
} from "@/lib/library-bookmarks";
import {
  LIBRARY_CATEGORY_LABEL,
  libraryBookPageHref,
} from "@/lib/library-materials";
import type { TeachingBookView } from "@/server/lms/library";

export function LibraryBookReader({ book }: { book: TeachingBookView }) {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(CLASSROOM_ZOOM_DEFAULT);
  const [fullscreen, setFullscreen] = useState(false);
  const [thumbsOpen, setThumbsOpen] = useState(true);
  const [flipping, setFlipping] = useState(false);
  const snapshot = useSyncExternalStore(
    subscribeLibraryBookmarks,
    () => JSON.stringify(readLibraryBookmarks(book.id)),
    () => "[]",
  );
  const bookmarks = JSON.parse(snapshot) as number[];
  const total = book.pages.length;
  const page = book.pages[index] ?? book.pages[0];
  const dir = page?.dir === "rtl" ? "rtl" : "ltr";
  const rtlBook = dir === "rtl";
  const slidesMode = book.viewKind === "slides";
  const slides = book.pages.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    imageFileId: item.imageFileId,
    dir: item.dir,
  }));

  const go = useCallback(
    (next: number) => {
      if (flipping || !total) return;
      setIndex(Math.max(0, Math.min(total - 1, next)));
    },
    [flipping, total],
  );

  const toggleFullscreen = useCallback(async () => {
    const node = root.current;
    if (!node) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setFullscreen(false);
      return;
    }
    await node.requestFullscreen();
    setFullscreen(true);
  }, []);

  if (!page) {
    return (
      <p className="rounded-[2rem] border border-line bg-surface p-6 text-sm font-semibold text-muted">
        {t("library.book_empty")}
      </p>
    );
  }

  return (
    <section
      ref={root}
      className="rounded-[2rem] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6"
    >
      <p className="font-heading text-sm font-bold tracking-tight text-brand">
        {t(LIBRARY_CATEGORY_LABEL[book.category])}
        {book.subjectName ? ` · ${book.subjectName}` : ""}
        {` · ${t("library.pages", { count: total })}`}
      </p>
      <div
        className="relative mt-4 overflow-hidden rounded-[1.5rem] bg-brand"
        style={{ height: `${Math.round(28 * (zoom / 100))}rem` }}
      >
        {slidesMode ? (
          <div
            dir={dir}
            className="flex h-full w-full items-center justify-center p-6"
          >
            {page.href ? (
              // Authenticated page bytes from the teaching library.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={page.href}
                alt={page.title}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="max-w-xl text-center text-white">
                <h2 className="font-heading text-2xl font-bold tracking-tight">
                  {page.title}
                </h2>
                {page.body.map((line) => (
                  <p key={line} className="mt-3 text-sm font-semibold text-white/85">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <ClassroomFlipbook
              slides={slides}
              index={index}
              name={book.title}
              pageSrc={(imageFileId) => libraryBookPageHref(book.id, imageFileId)}
              onFlippingChange={setFlipping}
            />
            <ClassroomFlipbookHits
              index={index}
              total={total}
              rtl={rtlBook}
              canTurn={!flipping}
              onTurn={go}
            />
          </>
        )}
      </div>
      <ClassroomReaderToolbar
        current={index + 1}
        total={total}
        zoom={zoom}
        fullscreen={fullscreen}
        thumbsOpen={thumbsOpen}
        bookmarked={bookmarks.includes(index)}
        canBookmark={bookmarks.length < CLASSROOM_MAX_BOOKMARKS || bookmarks.includes(index)}
        canPresent={false}
        canJump={!flipping}
        onJump={go}
        onZoom={setZoom}
        onFullscreen={() => {
          void toggleFullscreen();
        }}
        onBookmark={() => {
          toggleLibraryBookmark(book.id, index, total);
        }}
        onThumbs={() => setThumbsOpen((open) => !open)}
      />
      {thumbsOpen ? (
        <div className="mt-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-brand-soft">
            {t("classroom.thumbs")}
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
            {book.pages.map((item, pageIndex) => {
              const current = pageIndex === index;
              const marked = bookmarks.includes(pageIndex);
              return (
                <button
                  key={item.id}
                  type="button"
                  data-current={current ? "true" : undefined}
                  className={`relative h-20 w-14 shrink-0 overflow-hidden rounded-md border ${
                    current ? "border-brand-accent ring-2 ring-brand-accent" : "border-line"
                  }`}
                  onClick={() => go(pageIndex)}
                >
                  {item.href ? (
                    // Authenticated page bytes from the teaching library.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.href} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-[#FBF7EF] px-1 text-center text-[0.6rem] font-bold leading-tight text-brand">
                      {item.title.slice(0, 28)}
                    </span>
                  )}
                  {marked ? (
                    <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-brand-accent" />
                  ) : null}
                  <span className="absolute inset-x-0 bottom-0 bg-brand/75 py-0.5 text-center text-[0.6rem] font-extrabold text-white">
                    {pageIndex + 1}
                  </span>
                </button>
              );
            })}
          </div>
          {bookmarks.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-xs font-extrabold uppercase text-brand-soft">
                {t("classroom.bookmarks")}
              </span>
              {bookmarks.map((pageIndex) => (
                <Button
                  key={pageIndex}
                  type="button"
                  size="sm"
                  variant={pageIndex === index ? "primary" : "secondary"}
                  onClick={() => go(pageIndex)}
                >
                  {t("classroom.thumb_page", { n: pageIndex + 1 })}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
