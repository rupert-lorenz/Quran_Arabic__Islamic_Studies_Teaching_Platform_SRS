"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";

export type OwnTeacherReview = {
  id: string;
  rating: number;
  body: string;
  recommend: boolean;
  status: string;
} | null;

export function TeacherReviewForm({
  teacherUserId,
  initial,
}: {
  teacherUserId: string;
  initial: OwnTeacherReview;
}) {
  const [review, setReview] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        setMessage("");
        try {
          const result = await postJson<{
            review: NonNullable<OwnTeacherReview>;
            message: string;
          }>("/api/v1/reviews", {
            teacherUserId,
            rating: Number(form.get("rating")),
            body: String(form.get("body") ?? ""),
            recommend: form.get("recommend") === "on",
          });
          setReview(result.review);
          setMessage(result.message);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not submit review");
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="text-xl font-extrabold text-brand">Leave a review</h3>
      <p className="mt-2 text-sm text-muted">
        Parents can rate this teacher. Staff publish reviews after a short check.
      </p>
      {review ? (
        <p className="mt-3 text-sm font-semibold text-brand">
          Your current review is {review.status}. Updating it sends it for
          review again.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">Rating</span>
        <select
          name="rating"
          defaultValue={review?.rating ?? 5}
          className={fieldClass}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} star{value === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">Review</span>
        <textarea
          name="body"
          required
          minLength={20}
          maxLength={2000}
          defaultValue={review?.body ?? ""}
          className={`${fieldClass} min-h-32 py-3`}
          placeholder="What should another family know about lessons with this teacher?"
        />
      </label>
      <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-brand">
        <input
          type="checkbox"
          name="recommend"
          defaultChecked={review?.recommend ?? true}
          className="h-5 w-5"
        />
        I would book this teacher again
      </label>
      <div className="mt-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : review ? "Update review" : "Submit review"}
        </Button>
      </div>
    </form>
  );
}
