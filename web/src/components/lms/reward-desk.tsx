"use client";

import { useT } from "@/components/i18n/i18n-provider";
import type { UiMessageKey } from "@/lib/i18n";
import type { RewardDesk } from "@/server/lms/gamification";

const kindKeys = {
  quiz: "reward.kind.quiz",
  exam: "reward.kind.exam",
  homework: "reward.kind.homework",
  game: "reward.kind.game",
  course: "reward.kind.course",
  certificate: "reward.kind.certificate",
  lesson: "reward.kind.lesson",
} as const;

const levelKeys: Record<string, UiMessageKey> = {
  seed: "reward.level.seed",
  sprout: "reward.level.sprout",
  leaf: "reward.level.leaf",
  branch: "reward.level.branch",
  tree: "reward.level.tree",
  grove: "reward.level.grove",
};

const badgeKeys: Record<string, UiMessageKey> = {
  first_game: "reward.badge.first_game",
  first_quiz: "reward.badge.first_quiz",
  first_exam: "reward.badge.first_exam",
  first_homework: "reward.badge.first_homework",
  first_course: "reward.badge.first_course",
  first_certificate: "reward.badge.first_certificate",
  first_lesson: "reward.badge.first_lesson",
  streak_3: "reward.badge.streak_3",
  streak_7: "reward.badge.streak_7",
  points_50: "reward.badge.points_50",
  points_100: "reward.badge.points_100",
  points_250: "reward.badge.points_250",
  points_500: "reward.badge.points_500",
  stars_5: "reward.badge.stars_5",
  stars_15: "reward.badge.stars_15",
  stars_30: "reward.badge.stars_30",
};

function levelLabel(t: ReturnType<typeof useT>, key: string) {
  const message = levelKeys[key];
  return message ? t(message) : key;
}

function GoldStar({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`font-heading text-[#CB9F64] ${className}`.trim()}
    >
      ★
    </span>
  );
}

export function RewardDeskView({ desk }: { desk: RewardDesk }) {
  const t = useT();
  const profile = desk.profile;

  return (
    <div className="space-y-8">
      {desk.learners.length > 1 ? (
        <p className="text-sm font-semibold">
          {t("reward.choose")}
          {": "}
          {desk.learners.map((learner, index) => (
            <span key={learner.studentUserId}>
              {index ? " · " : null}
              <a href={learner.href} className="text-brand underline">
                {learner.name}
              </a>
            </span>
          ))}
        </p>
      ) : null}

      {profile ? (
        <>
          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
              {t("reward.for", { name: profile.studentName })}
            </p>
            <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
              {t("reward.level_line", {
                level: profile.level,
                title: levelLabel(t, profile.titleKey),
              })}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl bg-background px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {t("reward.points")}
                </p>
                <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
                  {profile.points}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("reward.points_line", { points: profile.points })}
                </p>
              </article>
              <article className="rounded-2xl bg-[#F3E6D0] px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-brand">
                  {t("reward.stars")}
                </p>
                <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
                  <GoldStar className="mr-1" />
                  {profile.stars}
                </p>
                <p className="mt-1 text-sm text-brand/80">
                  {t("reward.stars_line", { stars: profile.stars })}
                </p>
              </article>
              <article className="rounded-2xl bg-background px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {t("reward.streak_current")}
                </p>
                <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
                  {profile.streak}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("reward.streak_line", { count: profile.streak })}
                </p>
              </article>
              <article className="rounded-2xl bg-background px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {t("reward.streak_longest")}
                </p>
                <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
                  {profile.longestStreak}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("reward.streak_longest_line", {
                    count: profile.longestStreak,
                  })}
                </p>
              </article>
            </div>
          </section>

          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
              {t("reward.streaks")}
            </h2>
            <p className="mt-2 text-sm text-muted">{t("reward.streaks_help")}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-background px-4 py-3">
                <dt className="text-sm font-semibold text-muted">
                  {t("reward.streak_current")}
                </dt>
                <dd className="font-heading mt-1 text-xl font-bold tracking-tight text-brand">
                  {t("reward.streak_line", { count: profile.streak })}
                </dd>
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <dt className="text-sm font-semibold text-muted">
                  {t("reward.streak_longest")}
                </dt>
                <dd className="font-heading mt-1 text-xl font-bold tracking-tight text-brand">
                  {t("reward.streak_longest_line", {
                    count: profile.longestStreak,
                  })}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
              {t("reward.levels")}
            </h2>
            <p className="mt-2 text-sm text-muted">{t("reward.levels_help")}</p>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {profile.levels.map((level) => (
                <li
                  key={level.key}
                  className={`rounded-2xl px-4 py-4 ${
                    level.current
                      ? "border-2 border-[#CB9F64] bg-[#F3E6D0]"
                      : level.reached
                        ? "bg-[#F3E6D0]/70"
                        : "bg-background text-muted"
                  }`}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide">
                    {t("reward.level_line", {
                      level: level.number,
                      title: levelLabel(t, level.key),
                    })}
                  </p>
                  <p className="mt-2 text-sm">
                    {level.current
                      ? t("reward.level_current")
                      : level.reached
                        ? t("reward.level_reached")
                        : t("reward.level_need", { points: level.minPoints })}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#F3F4F2]">
              <div
                className="h-full rounded-full bg-[#CB9F64]"
                style={{
                  width: `${Math.min(100, (profile.intoLevel / 100) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-sm text-muted">
              {t("reward.next_level", {
                remain: Math.max(0, profile.nextLevelAt - profile.points),
              })}
            </p>
          </section>

          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
              {t("reward.badges")}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {profile.badges.map((badge) => (
                <li
                  key={badge.key}
                  className={`rounded-2xl px-4 py-3 ${
                    badge.earned
                      ? "bg-[#F3E6D0] font-semibold text-brand"
                      : "bg-background text-muted"
                  }`}
                >
                  {t(badgeKeys[badge.key] ?? "reward.badges")}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
              {t("reward.recent")}
            </h2>
            {profile.events.length ? (
              <ul className="mt-4 grid gap-2">
                {profile.events.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-2xl bg-background px-4 py-3"
                  >
                    <p className="font-heading font-bold tracking-tight text-brand">
                      {t(kindKeys[event.kind])} · {event.title}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {t("reward.points_gain", { points: event.points })}
                      {" · "}
                      <GoldStar />{" "}
                      {t("reward.stars_gain", { stars: event.stars })}
                      {" · "}
                      {new Date(event.at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">{t("reward.none.events")}</p>
            )}
          </section>
        </>
      ) : (
        <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
          {desk.learners.length ? t("reward.pick") : t("reward.none.learners")}
        </p>
      )}

      {desk.board.length ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
            {t("reward.board")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("reward.board_help")}</p>
          <ol className="mt-4 grid gap-2">
            {desk.board.map((learner, index) => (
              <li key={learner.studentUserId}>
                <a
                  href={learner.href}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-background px-4 py-3"
                >
                  <span className="font-heading font-bold tracking-tight text-brand">
                    {index + 1}. {learner.name}
                  </span>
                  <span className="text-sm font-semibold text-muted">
                    {t("reward.points_line", { points: learner.points })}
                    {" · "}
                    <GoldStar />{" "}
                    {t("reward.stars_line", { stars: learner.stars })}
                    {" · "}
                    {t("reward.level_line", {
                      level: learner.level,
                      title: levelLabel(t, learner.titleKey),
                    })}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
