"use client";

import { useMemo, useState } from "react";
import { ClassroomPreview } from "@/components/classroom/classroom-preview";
import { Button } from "@/components/ui/button";
import { fieldClass, putJson } from "@/lib/api";
import type { BrandProfile } from "@/lib/brand";
import type { ClassroomOverlay } from "@/lib/classroom-brand";
import { StaffFlash } from "./staff-stat";

export function StaffClassroomBrand({
  brand,
  initial,
}: {
  brand: BrandProfile;
  initial: ClassroomOverlay;
}) {
  const [overlay, setOverlay] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const preview = useMemo(() => overlay, [overlay]);

  function toggle<K extends keyof ClassroomOverlay>(key: K, value: ClassroomOverlay[K]) {
    setOverlay((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
      <form
        className="rounded-[2rem] border border-line bg-surface p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          setMessage("");
          try {
            const next = await putJson<{ overlay: ClassroomOverlay }>(
              "/api/v1/staff/brand",
              overlay,
            );
            setOverlay(next.overlay);
            setMessage("Classroom overlay saved.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
          } finally {
            setPending(false);
          }
        }}
      >
        <StaffFlash error={error} message={message} />
        <p className="text-sm leading-6 text-muted">
          Families stay inside {brand.name}. This overlay keeps the company mark,
          colours, and name on the live classroom for the whole lesson.
        </p>
        <fieldset className="mt-6 grid gap-3">
          <legend className="text-sm font-bold text-brand">Show on overlay</legend>
          {(
            [
              ["showMark", "Company mark"],
              ["showName", "English name"],
              ["showNameAr", "Arabic name"],
              ["showTagline", "Tagline"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 text-sm font-semibold text-brand">
              <input
                type="checkbox"
                checked={Boolean(overlay[key])}
                onChange={(event) => toggle(key, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="mt-5 block">
          <span className="mb-1 block text-sm font-bold text-brand">Watermark</span>
          <select
            className={fieldClass}
            value={overlay.watermark}
            onChange={(event) =>
              toggle("watermark", event.target.value as ClassroomOverlay["watermark"])
            }
          >
            <option value="both">Header bar and video corner</option>
            <option value="bar">Header bar only</option>
            <option value="corner">Video corner only</option>
          </select>
        </label>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Caption on the classroom
          </span>
          <input
            className={fieldClass}
            value={overlay.caption}
            maxLength={80}
            placeholder="Stay in this classroom. Do not share phone numbers."
            onChange={(event) => toggle("caption", event.target.value)}
          />
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-bold text-brand">Primary colour</span>
            <input
              type="color"
              className="h-12 w-full cursor-pointer rounded-2xl border border-line bg-background"
              value={overlay.primaryColor}
              onChange={(event) => toggle("primaryColor", event.target.value)}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-brand">Accent colour</span>
            <input
              type="color"
              className="h-12 w-full cursor-pointer rounded-2xl border border-line bg-background"
              value={overlay.accentColor}
              onChange={(event) => toggle("accentColor", event.target.value)}
            />
          </label>
        </div>
        <Button className="mt-6" disabled={pending}>
          {pending ? "Saving…" : "Save classroom overlay"}
        </Button>
      </form>
      <ClassroomPreview
        brand={brand}
        overlay={preview}
        title="In the classroom"
        body={`${brand.name} stays visible for the whole lesson.`}
        teacherLabel="Teacher"
        studentLabel="Student"
        studentTwoLabel="Student 2"
        boardLabel="Whiteboard"
        cameraLabel="Camera on"
        micLabel="Microphone on"
        shareLabel="Sharing screen"
        chatLabel="Lesson chat"
        chatSample="Assalamu alaikum. Stay in this classroom."
        timerLabel="24:00 left"
        recordingLabel="Recording"
        recordingSecureLabel="Encrypted"
        filesLabel="Lesson files"
        filesSample="Tajweed.pptx"
        slidesLabel="Lesson slides"
        slidesSample="Tajweed.pptx · Slide 3 of 12 · live marks"
        bookLabel="Lesson book"
        bookSample="Nuraniyyah.pdf · Flip · Page 4 of 18 · 125%"
        readerSample="125% · Fullscreen · In sync"
        boardTools="Pen · Highlighter · Eraser · Shapes · Text · Image · Pointer · Undo · Pages · Annotation · Arabic RTL · Tajweed · Slides · PDF · Book · Flipbook · Nav · Zoom · Fullscreen · Bookmarks · Thumbnails · Sync · Recording · Encrypted · Access · Retention"
      />
    </div>
  );
}
