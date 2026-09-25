"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, getJson, postJson } from "@/lib/api";
import {
  emptyGamePayload,
  type EducationalGameKind,
  type EducationalGamePayload,
  type EducationalGamePlayView,
} from "@/lib/games";
import type { EducationalGameView } from "@/server/lms/games";
import { GamesPlayer } from "./games-player";

const statusKeys = {
  draft: "games.status.draft",
  published: "games.status.published",
  archived: "games.status.archived",
} as const;

const kindKeys = {
  match: "games.kind.match",
  memory: "games.kind.memory",
  order: "games.kind.order",
  choice: "games.kind.choice",
} as const;

export function GamesDetail({
  initial,
  subjects,
}: {
  initial: EducationalGameView;
  subjects: Array<{ slug: string; name: string }>;
}) {
  const t = useT();
  const [item, setItem] = useState(initial);
  const [payload, setPayload] = useState<EducationalGamePayload>(
    initial.payload ?? emptyGamePayload(initial.kind),
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [studentUserId, setStudentUserId] = useState(
    initial.learners[0]?.studentUserId ?? "",
  );

  async function run(body: Record<string, unknown>, okMessage?: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<EducationalGameView & { result?: { score: number; total: number } }>(
        `/api/v1/games/${item.id}`,
        body,
      );
      setItem(next);
      if (next.payload) setPayload(next.payload);
      setMessage(
        next.result
          ? t("games.score", { score: next.result.score, total: next.result.total })
          : okMessage ?? t("games.saved"),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("games.failed"));
    } finally {
      setPending(false);
    }
  }

  async function replay() {
    setPending(true);
    setError("");
    try {
      const next = await getJson<EducationalGameView>(`/api/v1/games/${item.id}`);
      setItem(next);
      if (next.payload) setPayload(next.payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("games.failed"));
    } finally {
      setPending(false);
    }
  }

  function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    void run({
      action: "save",
      title: data.title,
      instructions: data.instructions,
      subjectSlug: data.subjectSlug,
      payload,
    });
  }

  return (
    <div className="space-y-6">
      {item.canManage ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold text-muted">
            {t(kindKeys[item.kind])} · {t(statusKeys[item.status])}
          </p>
          <form className="mt-4 grid gap-3" onSubmit={onSave}>
            <input
              name="title"
              required
              defaultValue={item.title}
              className={fieldClass}
            />
            <textarea
              name="instructions"
              rows={3}
              defaultValue={item.instructions ?? ""}
              placeholder={t("games.instructions")}
              className={`${fieldClass} min-h-24 py-3`}
            />
            <select
              name="subjectSlug"
              className={fieldClass}
              defaultValue={item.subjectSlug ?? ""}
            >
              <option value="">{t("library.any_subject")}</option>
              {subjects.map((subject) => (
                <option key={subject.slug} value={subject.slug}>
                  {subject.name}
                </option>
              ))}
            </select>
            <GameEditor kind={item.kind} payload={payload} onChange={setPayload} />
            <Button type="submit" disabled={pending}>
              {t("games.save")}
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-3">
            {item.status !== "published" ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() => run({ action: "set_status", status: "published" })}
              >
                {t("games.publish")}
              </Button>
            ) : null}
            {item.status === "published" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run({ action: "set_status", status: "draft" })}
              >
                {t("games.unpublish")}
              </Button>
            ) : null}
            {item.status !== "archived" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run({ action: "set_status", status: "archived" })}
              >
                {t("games.archive")}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {item.play ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
            {t("games.play")}
          </h2>
          {item.instructions ? (
            <p className="mt-2 text-sm text-muted" dir="auto">
              {item.instructions}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">{t(kindKeys[item.kind])}</p>
          )}
          {item.learners.length > 1 ? (
            <label className="mt-4 block text-sm font-semibold text-brand">
              {t("games.choose_child")}
              <select
                className={`${fieldClass} mt-2`}
                value={studentUserId}
                onChange={(event) => setStudentUserId(event.target.value)}
              >
                {item.learners.map((learner) => (
                  <option key={learner.studentUserId} value={learner.studentUserId}>
                    {learner.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="mt-5">
            <GamesPlayer
              play={item.play as EducationalGamePlayView}
              pending={pending}
              onSubmit={(input) =>
                void run({
                  action: "play",
                  ...input,
                  studentUserId: studentUserId || undefined,
                })
              }
            />
          </div>
          {item.lastPlay ? (
            <p className="mt-4 text-sm font-semibold text-brand">
              {t("games.last_score", {
                score: item.lastPlay.score,
                total: item.lastPlay.total,
              })}
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            disabled={pending}
            onClick={() => void replay()}
          >
            {t("games.again")}
          </Button>
        </section>
      ) : null}

      {item.canManage && item.plays.length ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            {t("games.plays")}
          </h2>
          <ul className="mt-3 grid gap-2 text-sm font-semibold text-muted">
            {item.plays.map((play) => (
              <li key={`${play.studentUserId}-${play.completedAt}`}>
                {play.studentName} ·{" "}
                {t("games.score", { score: play.score, total: play.total })} ·{" "}
                {new Date(play.completedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? <p className="text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-brand">{message}</p> : null}
    </div>
  );
}

function GameEditor({
  kind,
  payload,
  onChange,
}: {
  kind: EducationalGameKind;
  payload: EducationalGamePayload;
  onChange: (payload: EducationalGamePayload) => void;
}) {
  const t = useT();
  if (kind === "order" && "items" in payload) {
    return (
      <div className="grid gap-2">
        <input
          value={payload.prompt ?? ""}
          onChange={(event) =>
            onChange({ ...payload, prompt: event.target.value })
          }
          placeholder={t("games.order_prompt")}
          className={fieldClass}
        />
        {payload.items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={item}
              dir="auto"
              onChange={(event) => {
                const items = [...payload.items];
                items[index] = event.target.value;
                onChange({ ...payload, items });
              }}
              placeholder={t("games.item")}
              className={fieldClass}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                onChange({
                  ...payload,
                  items: payload.items.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            >
              {t("games.remove")}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange({ ...payload, items: [...payload.items, ""] })}
        >
          {t("games.add_item")}
        </Button>
      </div>
    );
  }
  if (kind === "choice" && "questions" in payload) {
    return (
      <div className="grid gap-4">
        {payload.questions.map((question, questionIndex) => (
          <div key={questionIndex} className="rounded-2xl bg-background p-4">
            <input
              value={question.prompt}
              dir="auto"
              onChange={(event) => {
                const questions = payload.questions.map((row, index) =>
                  index === questionIndex
                    ? { ...row, prompt: event.target.value }
                    : row,
                );
                onChange({ questions });
              }}
              placeholder={t("games.question")}
              className={fieldClass}
            />
            <ul className="mt-3 grid gap-2">
              {question.choices.map((choice, choiceIndex) => (
                <li key={choiceIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`answer-${questionIndex}`}
                    checked={question.answer === choiceIndex}
                    onChange={() => {
                      const questions = payload.questions.map((row, index) =>
                        index === questionIndex
                          ? { ...row, answer: choiceIndex }
                          : row,
                      );
                      onChange({ questions });
                    }}
                  />
                  <input
                    value={choice}
                    dir="auto"
                    onChange={(event) => {
                      const questions = payload.questions.map((row, index) => {
                        if (index !== questionIndex) return row;
                        const choices = [...row.choices];
                        choices[choiceIndex] = event.target.value;
                        return { ...row, choices };
                      });
                      onChange({ questions });
                    }}
                    placeholder={t("games.choice")}
                    className={fieldClass}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const questions = payload.questions.map((row, index) =>
                    index === questionIndex
                      ? { ...row, choices: [...row.choices, ""] }
                      : row,
                  );
                  onChange({ questions });
                }}
              >
                {t("games.add_choice")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  onChange({
                    questions: payload.questions.filter(
                      (_, index) => index !== questionIndex,
                    ),
                  })
                }
              >
                {t("games.remove")}
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onChange({
              questions: [
                ...payload.questions,
                { prompt: "", choices: ["", ""], answer: 0 },
              ],
            })
          }
        >
          {t("games.add_question")}
        </Button>
      </div>
    );
  }
  const pairs = "pairs" in payload ? payload.pairs : [];
  return (
    <div className="grid gap-2">
      {pairs.map((pair, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <input
            value={pair.left}
            dir="auto"
            onChange={(event) => {
              const next = pairs.map((row, rowIndex) =>
                rowIndex === index ? { ...row, left: event.target.value } : row,
              );
              onChange({ pairs: next });
            }}
            placeholder={t("games.left")}
            className={fieldClass}
          />
          <input
            value={pair.right}
            dir="auto"
            onChange={(event) => {
              const next = pairs.map((row, rowIndex) =>
                rowIndex === index ? { ...row, right: event.target.value } : row,
              );
              onChange({ pairs: next });
            }}
            placeholder={t("games.right")}
            className={fieldClass}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onChange({ pairs: pairs.filter((_, rowIndex) => rowIndex !== index) })
            }
          >
            {t("games.remove")}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange({ pairs: [...pairs, { left: "", right: "" }] })}
      >
        {t("games.add_pair")}
      </Button>
    </div>
  );
}
