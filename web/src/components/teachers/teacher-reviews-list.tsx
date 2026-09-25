export type PublishedTeacherReview = {
  id: string;
  rating: number;
  body: string;
  recommend: boolean;
  createdAt: string | Date;
  author: string;
};

export function TeacherReviewsList({
  reviews,
}: {
  reviews: PublishedTeacherReview[];
}) {
  if (reviews.length === 0) {
    return (
      <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
        No published reviews yet.
      </p>
    );
  }

  return (
    <ul className="grid gap-4">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
        >
          <p className="text-sm font-extrabold text-brand">
            {review.rating} ★ · {review.author}
            {review.recommend ? " · Would book again" : ""}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">{review.body}</p>
          <p className="mt-3 text-xs font-bold text-brand-soft">
            {new Date(review.createdAt).toLocaleDateString("en-GB")}
          </p>
        </li>
      ))}
    </ul>
  );
}
