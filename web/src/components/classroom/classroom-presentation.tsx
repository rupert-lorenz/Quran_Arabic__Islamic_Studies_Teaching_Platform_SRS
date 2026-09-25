"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClassroomFlipbook, ClassroomFlipbookHits } from "@/components/classroom/classroom-flipbook";
import {
  CLASSROOM_ZOOM_DEFAULT,
  ClassroomPageSync,
  ClassroomReaderToolbar,
  ClassroomThumbnails,
  stepClassroomZoom,
} from "@/components/classroom/classroom-reader";
import { ClassroomWhiteboard } from "@/components/classroom/classroom-whiteboard";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import type {
  ClassroomPresentation,
  ClassroomWhiteboardDocument,
} from "@/db/schema/classrooms";
import { classroomFileHref, type ClassroomSharedFile } from "@/lib/classroom-files";
import { CLASSROOM_MAX_BOOKMARKS, presentationAsBoard } from "@/lib/classroom-pptx";
import {
  classroomStudentsCanAnnotate,
  type ClassroomAnnotator,
  type ClassroomWhiteboardInput,
  type ClassroomWhiteboardPointer,
} from "@/lib/classroom-whiteboard";

export function ClassroomPresentationStage({
  deck,
  board,
  files,
  classroomId,
  selfId,
  selfName,
  people,
  canPresent,
  canDraw,
  canClear,
  locked,
  remotePointers,
  onChange,
  onUpdate,
  onUploadImage,
}: {
  deck: ClassroomPresentation;
  board: ClassroomWhiteboardDocument;
  files: ClassroomSharedFile[];
  classroomId: string;
  selfId: string;
  selfName?: string;
  people?: ClassroomAnnotator[];
  canPresent: boolean;
  canDraw: boolean;
  canClear: boolean;
  locked?: boolean;
  remotePointers?: ClassroomWhiteboardPointer[];
  onChange: (input: {
    action: "close" | "goto" | "bookmark" | "lock";
    slideIndex?: number;
    followLocked?: boolean;
  }) => void;
  onUpdate: (input: ClassroomWhiteboardInput) => Promise<void>;
  onUploadImage: (file: File) => Promise<ClassroomSharedFile>;
}) {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const classIndex = deck.slideIndex;
  const pagesLocked = deck.followLocked !== false;
  const [followClass, setFollowClass] = useState(true);
  const [localIndex, setLocalIndex] = useState(classIndex);
  const following = canPresent || followClass || pagesLocked;
  const viewIndex = following
    ? classIndex
    : Math.max(0, Math.min(deck.slides.length - 1, localIndex));
  const slide = deck.slides[viewIndex] ?? deck.slides[classIndex] ?? deck.slides[0];
  const total = deck.slides.length;
  const current = viewIndex + 1;
  const dir = slide?.dir === "rtl" ? "rtl" : "ltr";
  const book = deck.kind === "pdf" || deck.kind === "epub";
  const rtlBook = Boolean(book && dir === "rtl");
  const canTurn = canPresent || !pagesLocked;
  const slideBoard = presentationAsBoard(
    deck,
    classroomStudentsCanAnnotate(board),
    viewIndex,
  );
  const bookmarks = deck.bookmarks ?? [];
  const bookmarked = bookmarks.includes(classIndex);
  const [flipping, setFlipping] = useState(false);
  const [zoom, setZoom] = useState(CLASSROOM_ZOOM_DEFAULT);
  const [fullscreen, setFullscreen] = useState(false);
  const [thumbsOpen, setThumbsOpen] = useState(true);

  if (pagesLocked && !followClass) {
    setFollowClass(true);
  }

  const go = useCallback(
    (slideIndex: number) => {
      if (flipping) return;
      const next = Math.max(0, Math.min(total - 1, slideIndex));
      if (canPresent) {
        onChange({ action: "goto", slideIndex: next });
        return;
      }
      if (pagesLocked) return;
      setFollowClass(false);
      setLocalIndex(next);
    },
    [canPresent, flipping, onChange, pagesLocked, total],
  );

  const followTeacher = useCallback(() => {
    setFollowClass(true);
    setLocalIndex(classIndex);
  }, [classIndex]);

  const toggleFullscreen = useCallback(async () => {
    const node = root.current;
    if (!node) return;
    try {
      if (document.fullscreenElement === node) {
        await document.exitFullscreen();
        return;
      }
      const request =
        node.requestFullscreen?.bind(node) ??
        (
          node as HTMLElement & {
            webkitRequestFullscreen?: () => Promise<void> | void;
          }
        ).webkitRequestFullscreen?.bind(node);
      await request?.();
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    function onFull() {
      setFullscreen(document.fullscreenElement === root.current);
    }
    document.addEventListener("fullscreenchange", onFull);
    return () => document.removeEventListener("fullscreenchange", onFull);
  }, []);

  useEffect(() => {
    function typing(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      return Boolean(
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable),
      );
    }
    function onKey(event: KeyboardEvent) {
      if (typing(event)) return;
      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          event.preventDefault();
          void document.exitFullscreen();
          return;
        }
        if (canPresent) {
          event.preventDefault();
          onChange({ action: "close" });
        }
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((value) => stepClassroomZoom(value, 1));
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom((value) => stepClassroomZoom(value, -1));
        return;
      }
      if (event.key === "0" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setZoom(CLASSROOM_ZOOM_DEFAULT);
        return;
      }
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }
      if (!canTurn) return;
      if (event.key === "Home") {
        event.preventDefault();
        go(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        go(total - 1);
        return;
      }
      const nextKey = event.key === "ArrowRight" || event.key === "PageDown";
      const prevKey = event.key === "ArrowLeft" || event.key === "PageUp";
      if (nextKey) {
        event.preventDefault();
        go(rtlBook ? viewIndex - 1 : viewIndex + 1);
        return;
      }
      if (prevKey) {
        event.preventDefault();
        go(rtlBook ? viewIndex + 1 : viewIndex - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPresent, canTurn, go, onChange, rtlBook, toggleFullscreen, total, viewIndex]);

  if (!slide) return null;

  const backdrop = book ? (
    <ClassroomFlipbook
      slides={deck.slides}
      index={viewIndex}
      name={deck.name}
      classroomId={classroomId}
      onFlippingChange={setFlipping}
    />
  ) : (
    <article dir={dir} className="flex h-full flex-col bg-background px-6 py-5 sm:px-10 sm:py-8">
      <p className="font-heading text-lg font-bold tracking-tight text-brand sm:text-2xl">
        {slide.title}
      </p>
      {slide.body.length ? (
        <ul className="mt-4 space-y-2 text-sm font-semibold leading-6 text-brand sm:text-base">
          {slide.body.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>
      ) : null}
      {slide.imageFileId ? (
        // Classroom slide images are session-authenticated file bytes.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={classroomFileHref(classroomId, slide.imageFileId)}
          alt=""
          className="mt-4 max-h-[46%] w-full object-contain"
        />
      ) : null}
    </article>
  );

  return (
    <section
      ref={root}
      className="classroom-reader rounded-[1.5rem] border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-sm font-bold tracking-tight text-brand-soft uppercase">
            {book ? t("classroom.book") : t("classroom.slides")}
          </h2>
          <p className="mt-1 text-xs font-semibold text-muted">
            {deck.name}
            {" · "}
            {book
              ? t("classroom.book_of", { current, total })
              : t("classroom.slides_of", { current, total })}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            {canPresent
              ? t("classroom.sync_help")
              : pagesLocked
                ? t("classroom.sync_locked_help")
                : t("classroom.reader_follow")}
          </p>
        </div>
        {canTurn ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={viewIndex <= 0}
              onClick={() => go(0)}
            >
              {t("classroom.page_first")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={viewIndex <= 0}
              onClick={() => go(viewIndex - 1)}
            >
              {book ? t("classroom.book_prev") : t("classroom.slides_prev")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={viewIndex >= total - 1}
              onClick={() => go(viewIndex + 1)}
            >
              {book ? t("classroom.book_next") : t("classroom.slides_next")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={viewIndex >= total - 1}
              onClick={() => go(total - 1)}
            >
              {t("classroom.page_last")}
            </Button>
            {canPresent ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ action: "close" })}>
                {t("classroom.slides_stop")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <ClassroomPageSync
        following={followClass}
        locked={pagesLocked}
        viewIndex={viewIndex}
        classIndex={classIndex}
        total={total}
        canPresent={canPresent}
        onFollow={followTeacher}
        onLock={(next) => onChange({ action: "lock", followLocked: next })}
      />
      <ClassroomReaderToolbar
        current={current}
        total={total}
        zoom={zoom}
        fullscreen={fullscreen}
        thumbsOpen={thumbsOpen}
        bookmarked={bookmarked}
        canBookmark={bookmarks.length < CLASSROOM_MAX_BOOKMARKS}
        canPresent={canPresent}
        canJump={canTurn}
        onJump={go}
        onZoom={setZoom}
        onFullscreen={() => void toggleFullscreen()}
        onBookmark={() => onChange({ action: "bookmark", slideIndex: classIndex })}
        onThumbs={() => setThumbsOpen((value) => !value)}
      />
      <ClassroomWhiteboard
        board={slideBoard}
        files={files}
        classroomId={classroomId}
        selfId={selfId}
        selfName={selfName}
        people={people}
        canDraw={canDraw}
        canClear={canClear}
        locked={locked}
        stayWithClass={following}
        remotePointers={remotePointers}
        surface="slides"
        backdrop={backdrop}
        stageOverlay={
          book ? (
            <ClassroomFlipbookHits
              index={viewIndex}
              total={total}
              rtl={rtlBook}
              canTurn={canTurn}
              onTurn={go}
            />
          ) : null
        }
        marksHidden={flipping}
        zoom={zoom / 100}
        onZoomWheel={(deltaY) =>
          setZoom((value) => stepClassroomZoom(value, deltaY > 0 ? -1 : 1))
        }
        onUpdate={onUpdate}
        onUploadImage={onUploadImage}
      />
      <ClassroomThumbnails
        deck={deck}
        classroomId={classroomId}
        canTurn={canTurn}
        open={thumbsOpen}
        viewIndex={viewIndex}
        classIndex={classIndex}
        onTurn={go}
      />
    </section>
  );
}
