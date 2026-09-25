"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson } from "@/lib/api";

export type StaffTeacherReview = {
  id: string;
  teacherUserId: string;
  parentUserId: string;
  rating: number;
  body: string;
  recommend: boolean;
  status: "pending" | "published" | "hidden";
  moderationNote: string | null;
  createdAt: string | Date;
  teacherName: string;
  parentName: string;
  parentEmail: string;
};

export function StaffReviews({
  initial,
  canModerate,
}: {
  initial: StaffTeacherReview[];
  canModerate: boolean;
}) {
  const [reviews, setReviews] = useState(initial);
  const [filter, setFilter] = useState("pending");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");

  const visible = useMemo(
    () =>
      reviews.filter((review) => (filter === "all" ? true : review.status === filter)),
    [filter, reviews],
  );

  async function moderate(
    reviewId: string,
    status: "published" | "hidden" | "pending",
    note: string,
  ) {
    setPendingId(reviewId);
    setError("");
    try {
      const updated = await patchJson<StaffTeacherReview>(
        `/api/v1/staff/reviews/${reviewId}`,
        { status, note },
      );
      setReviews((current) =>
        current.map((item) => (item.id === reviewId ? { ...item, ...updated } : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update review");
    } finally {
      setPendingId("");
    }
  }

  return (
    <div>
      {error ? (
        <p className="mb-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {["pending", "published", "hidden", "all"].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              filter === status ? "bg-brand text-white" : "bg-mint text-brand"
            }`}
          >
            {status.replace("_", " ")}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="mt-6 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
          No reviews in this filter.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {visible.map((review) => (
            <li
              key={review.id}
              className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <p className="text-sm font-extrabold text-brand">
                {review.rating} ★ · {review.teacherName}
              </p>
              <p className="mt-1 text-sm text-muted">
                {review.parentName} · {review.parentEmail} · {review.status}
                {review.recommend ? " · Would book again" : ""}
              </p>
              <p className="mt-3 text-sm leading-6 text-brand">{review.body}</p>
              {review.moderationNote ? (
                <p className="mt-3 text-xs font-semibold text-brand-soft">
                  Note: {review.moderationNote}
                </p>
              ) : null}
              {canModerate ? (
                <form
                  className="mt-4 grid gap-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    await moderate(
                      review.id,
                      String(form.get("status")) as "published" | "hidden" | "pending",
                      String(form.get("note") ?? ""),
                    );
                  }}
                >
                  <label className="block">
                    <span className="mb-1 block text-sm font-bold text-brand">
                      Decision
                    </span>
                    <select
                      name="status"
                      defaultValue={
                        review.status === "pending" ? "published" : review.status
                      }
                      className={fieldClass}
                    >
                      <option value="published">Publish</option>
                      <option value="hidden">Hide</option>
                      <option value="pending">Keep pending</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-bold text-brand">
                      Note
                    </span>
                    <input
                      name="note"
                      defaultValue={review.moderationNote ?? ""}
                      className={fieldClass}
                    />
                  </label>
                  <div>
                    <Button type="submit" disabled={pendingId === review.id}>
                      {pendingId === review.id ? "Saving…" : "Save decision"}
                    </Button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
