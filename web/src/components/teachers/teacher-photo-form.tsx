"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";
import { TeacherPortrait } from "./teacher-portrait";

export function TeacherPhotoForm({
  name,
  photoUrl,
  onSaved,
}: {
  name: string;
  photoUrl?: string | null;
  onSaved: (photoUrl: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(photoUrl ?? "");

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-extrabold text-brand">Profile photo</h2>
      <p className="mt-2 text-sm text-muted">
        Families see this on the home page and teacher cards. Use a clear, well-lit
        face photo.
      </p>
      <div className="mt-5 flex items-center gap-4">
        <TeacherPortrait name={name} src={preview || null} size="lg" />
        <p className="text-sm font-semibold text-brand">{name}</p>
      </div>
      <form
        className="mt-5 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setPending(true);
          setError("");
          setMessage("");
          try {
            const saved = await postJson<{ photoUrl: string }>(
              "/api/v1/teacher/profile/photo",
              { externalUrl: String(form.get("externalUrl") ?? "") },
            );
            setPreview(saved.photoUrl);
            onSaved(saved.photoUrl);
            setMessage("Profile photo saved. Families can see it now.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save photo");
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            https photo link
          </span>
          <input
            name="externalUrl"
            required
            defaultValue={photoUrl ?? ""}
            className={fieldClass}
            placeholder="https://..."
          />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save photo"}
        </Button>
      </form>
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
