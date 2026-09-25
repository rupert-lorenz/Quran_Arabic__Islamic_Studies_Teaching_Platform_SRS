"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";
import { introVideoGuidance, type IntroVideoPlayback } from "@/lib/intro-video";
import { reviewStatusLabel } from "@/lib/teacher-documents";
import { IntroVideoPlayer } from "./intro-video-player";

export type IntroVideoState = {
  externalUrl: string | null;
  reviewStatus?: string;
  reviewNote?: string | null;
  playback?: IntroVideoPlayback | null;
};

export function IntroVideoForm<T extends { video: IntroVideoState | null }>({
  video,
  canEdit,
  title = "Introduction video",
  onSaved,
}: {
  video: IntroVideoState | null;
  canEdit: boolean;
  title?: string;
  onSaved: (state: T) => Promise<void> | void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-extrabold text-brand">{title}</h2>
      <p className="mt-2 text-sm text-muted">
        Families watch this before they book. Staff verify every new link.
      </p>
      <ul className="mt-4 list-disc space-y-1 ps-5 text-sm text-brand">
        {introVideoGuidance.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {video?.playback || video?.externalUrl ? (
        <div className="mt-5">
          <IntroVideoPlayer
            playback={video.playback}
            url={video.externalUrl}
            title="Your introduction video"
          />
          {video.reviewStatus ? (
            <p className="mt-3 text-sm font-semibold text-brand">
              {reviewStatusLabel(video.reviewStatus)}
              {video.reviewNote ? ` · Staff note: ${video.reviewNote}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      {canEdit ? (
        <form
          className="mt-5 grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setPending(true);
            setError("");
            setMessage("");
            try {
              const next = await postJson<T>("/api/v1/teacher/onboarding/video", {
                originalName: "Introduction video",
                externalUrl: String(data.get("externalUrl") ?? ""),
              });
              await onSaved(next);
              setMessage("Introduction video saved.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save video");
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              YouTube, Vimeo, or https video link
            </span>
            <input
              name="externalUrl"
              required
              defaultValue={video?.externalUrl ?? ""}
              className={fieldClass}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </label>
          <Button type="submit" disabled={pending}>
            Save video link
          </Button>
        </form>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
    </section>
  );
}
