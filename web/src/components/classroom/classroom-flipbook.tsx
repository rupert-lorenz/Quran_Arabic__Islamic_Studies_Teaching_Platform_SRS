"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import type { ClassroomPresentationSlide } from "@/db/schema/classrooms";
import { classroomFileHref } from "@/lib/classroom-files";

const FLIP_MS = 480;

export function ClassroomFlipbook({
  slides,
  index,
  name,
  classroomId,
  pageSrc,
  onFlippingChange,
}: {
  slides: ClassroomPresentationSlide[];
  index: number;
  name: string;
  classroomId?: string;
  pageSrc?: (imageFileId: string) => string;
  onFlippingChange?: (flipping: boolean) => void;
}) {
  const src =
    pageSrc ??
    ((imageFileId: string) => classroomFileHref(classroomId ?? "", imageFileId));
  const current = slides[index] ?? slides[0];
  const total = slides.length;
  const rtl = current?.dir === "rtl";
  const shown = useRef(index);
  const [flip, setFlip] = useState<{
    from: number;
    way: "forward" | "back";
    turned: boolean;
  } | null>(null);

  useEffect(() => {
    if (index === shown.current) return;
    const way = index > shown.current ? "forward" : "back";
    const from = shown.current;
    shown.current = index;
    setFlip({ from, way, turned: false });
    onFlippingChange?.(true);
    const start = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setFlip((currentFlip) =>
          currentFlip ? { ...currentFlip, turned: true } : currentFlip,
        );
      });
    });
    const done = window.setTimeout(() => {
      setFlip(null);
      onFlippingChange?.(false);
    }, FLIP_MS);
    return () => {
      window.cancelAnimationFrame(start);
      window.clearTimeout(done);
    };
  }, [index, onFlippingChange]);

  if (!current) return null;

  const outgoing = flip ? slides[flip.from] ?? current : null;
  const originStart = rtl ? flip?.way === "back" : flip?.way === "forward";

  return (
    <div className="classroom-flipbook flex h-full w-full items-stretch justify-center bg-brand px-3 py-3 sm:px-8 sm:py-4">
      <div className="relative h-full w-full max-w-[46rem] [transform-style:preserve-3d]">
        <div className="pointer-events-none absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-sm bg-[#d9c49a]" />
        <div className="pointer-events-none absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-sm bg-[#E8D9B8]" />
        <BookLeaf
          pageSrc={src}
          name={name}
          slide={current}
          current={index + 1}
          total={total}
        />
        {outgoing && flip ? (
          <div
            className={`classroom-flipbook-leaf absolute inset-0 ${
              originStart ? "origin-start" : "origin-end"
            } ${flip.turned ? "is-turned" : ""}`}
          >
            <BookLeaf
              pageSrc={src}
              name={name}
              slide={outgoing}
              current={flip.from + 1}
              total={total}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ClassroomFlipbookHits({
  index,
  total,
  rtl,
  canTurn,
  onTurn,
}: {
  index: number;
  total: number;
  rtl: boolean;
  canTurn: boolean;
  onTurn: (index: number) => void;
}) {
  const t = useT();
  const canPrev = canTurn && index > 0;
  const canNext = canTurn && index < total - 1;
  if (!canPrev && !canNext) return null;
  const startGoesNext = rtl;
  return (
    <>
      <TurnHit
        side="start"
        label={startGoesNext ? t("classroom.book_next") : t("classroom.book_prev")}
        disabled={startGoesNext ? !canNext : !canPrev}
        onTurn={() => onTurn(startGoesNext ? index + 1 : index - 1)}
      />
      <TurnHit
        side="end"
        label={startGoesNext ? t("classroom.book_prev") : t("classroom.book_next")}
        disabled={startGoesNext ? !canPrev : !canNext}
        onTurn={() => onTurn(startGoesNext ? index - 1 : index + 1)}
      />
    </>
  );
}

function BookLeaf({
  pageSrc,
  name,
  slide,
  current,
  total,
}: {
  pageSrc: (imageFileId: string) => string;
  name: string;
  slide: ClassroomPresentationSlide;
  current: number;
  total: number;
}) {
  const dir = slide.dir === "rtl" ? "rtl" : "ltr";
  return (
    <article
      dir={dir}
      className="relative flex h-full w-full flex-col overflow-hidden rounded-sm border border-[#e8d7b5] bg-[#FBF7EF] px-6 py-5 shadow-[8px_0_0_#E8D9B8,12px_8px_24px_rgba(0,0,0,0.28)] sm:px-10 sm:py-7"
    >
      <span className="classroom-flipbook-curl pointer-events-none absolute end-0 top-0 h-10 w-10" />
      <p className="font-heading text-[0.7rem] font-bold tracking-wide text-brand-accent uppercase">
        {name}
      </p>
      {slide.imageFileId ? (
        // Classroom book pages are session-authenticated file bytes.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pageSrc(slide.imageFileId)}
          alt=""
          className="mt-3 min-h-0 flex-1 object-contain"
        />
      ) : (
        <div className="mt-3 min-h-0 flex-1 overflow-hidden">
          <p className="font-heading text-xl font-bold tracking-tight text-brand sm:text-2xl">
            {slide.title}
          </p>
          {slide.body.length ? (
            <div className="mt-4 space-y-2 text-sm font-semibold leading-7 text-brand sm:text-base">
              {slide.body.map((line, index) => (
                <p key={`${index}-${line}`}>{line}</p>
              ))}
            </div>
          ) : null}
        </div>
      )}
      <p className="mt-3 text-center text-xs font-bold text-muted">
        {current} / {total}
      </p>
    </article>
  );
}

function TurnHit({
  side,
  label,
  disabled,
  onTurn,
}: {
  side: "start" | "end";
  label: string;
  disabled: boolean;
  onTurn: () => void;
}) {
  const startX = useRef<number | null>(null);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={`absolute inset-y-0 z-30 w-[18%] bg-transparent pointer-events-auto ${
        side === "start" ? "start-0" : "end-0"
      } ${disabled ? "cursor-default" : "cursor-pointer"}`}
      onPointerDown={(event) => {
        startX.current = event.clientX;
      }}
      onPointerUp={(event) => {
        const from = startX.current;
        startX.current = null;
        if (from == null) return;
        const delta = event.clientX - from;
        if (Math.abs(delta) < 8) {
          onTurn();
          return;
        }
        if (side === "end" && delta < -24) onTurn();
        if (side === "start" && delta > 24) onTurn();
      }}
    />
  );
}
