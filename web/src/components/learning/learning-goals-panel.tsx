"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteJson, fieldClass, patchJson, postJson } from "@/lib/api";
import {
  defaultLearningGoalTitle,
  learningGoalKinds,
  MAX_LEARNING_GOALS,
} from "@/lib/learning-goals";
import type { LearningGoalView } from "@/lib/learning-goals";

type GoalsResponse = { goals: LearningGoalView[] };

function GoalFormFields({
  catalog,
  initial,
  idPrefix,
}: {
  catalog: { slug: string; name: string }[];
  initial?: Partial<LearningGoalView>;
  idPrefix: string;
}) {
  const [kind, setKind] = useState(initial?.kind ?? "fluency");

  return (
    <div className="grid gap-4">
      <label className="grid gap-2 text-sm font-bold text-brand" htmlFor={`${idPrefix}-kind`}>
        Goal type
        <select
          id={`${idPrefix}-kind`}
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className={fieldClass}
        >
          {learningGoalKinds.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-bold text-brand" htmlFor={`${idPrefix}-title`}>
        Title
        <input
          id={`${idPrefix}-title`}
          name="title"
          defaultValue={initial?.title ?? ""}
          placeholder={defaultLearningGoalTitle(kind)}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-brand" htmlFor={`${idPrefix}-subject`}>
        Subject (optional)
        <select
          id={`${idPrefix}-subject`}
          name="subjectSlug"
          defaultValue={initial?.subjectSlug ?? ""}
          className={fieldClass}
        >
          <option value="">Any subject</option>
          {catalog.map((subject) => (
            <option key={subject.slug} value={subject.slug}>
              {subject.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-bold text-brand" htmlFor={`${idPrefix}-target`}>
        Target date (optional)
        <input
          id={`${idPrefix}-target`}
          name="targetDate"
          type="date"
          defaultValue={initial?.targetDate ?? ""}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-brand" htmlFor={`${idPrefix}-detail`}>
        Notes (optional)
        <textarea
          id={`${idPrefix}-detail`}
          name="detail"
          rows={3}
          defaultValue={initial?.detail ?? ""}
          className={`${fieldClass} py-3`}
        />
      </label>
    </div>
  );
}

function readGoalForm(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    kind: String(data.get("kind") ?? ""),
    title: String(data.get("title") ?? ""),
    subjectSlug: String(data.get("subjectSlug") ?? ""),
    targetDate: String(data.get("targetDate") ?? ""),
    detail: String(data.get("detail") ?? ""),
  };
}

export function LearningGoalsPanel({
  title = "Learning goals",
  description,
  goals,
  catalog,
  createAction,
  itemActionBase,
}: {
  title?: string;
  description?: string;
  goals: LearningGoalView[];
  catalog: { slug: string; name: string }[];
  createAction: string;
  itemActionBase: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(goals);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const itemAction = (id: string) => `${itemActionBase}/${id}`;
  const canAdd = items.length < MAX_LEARNING_GOALS;
  const activeCount = useMemo(
    () => items.filter((item) => item.status === "active").length,
    [items],
  );

  async function run(action: () => Promise<GoalsResponse>, success: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await action();
      setItems(next.goals);
      setEditingId(null);
      setMessage(success);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update goals");
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {description ??
            "Write what this learner is working toward. Teachers will use these goals when booking opens."}
        </p>
        <p className="mt-3 text-sm font-semibold text-brand">
          {activeCount
            ? `${activeCount} active ${activeCount === 1 ? "goal" : "goals"}`
            : "No active goals yet"}
          {items.length ? ` · ${items.length} total` : ""}
        </p>
      </section>

      {canAdd ? (
        <form
          className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const payload = readGoalForm(form);
            const saved = await run(
              () => postJson<GoalsResponse>(createAction, payload),
              "Goal added.",
            );
            if (saved) {
              form.reset();
            }
          }}
        >
          <h3 className="text-lg font-extrabold text-brand">Add a goal</h3>
          <div className="mt-4">
            <GoalFormFields catalog={catalog} idPrefix="new-goal" />
          </div>
          <div className="mt-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add goal"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="rounded-[2rem] border border-line bg-surface px-6 py-4 text-sm text-muted">
          This learner already has {MAX_LEARNING_GOALS} goals. Complete or
          remove one before adding another.
        </p>
      )}

      {items.length ? (
        <ul className="grid gap-4">
          {items.map((goal) => (
            <li
              key={goal.id}
              className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold text-brand">{goal.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    {goal.kindLabel}
                    {goal.subjectName ? ` · ${goal.subjectName}` : ""}
                    {goal.targetDate ? ` · Target ${goal.targetDate}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-mint px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand">
                  {goal.statusLabel}
                </span>
              </div>
              {goal.detail ? (
                <p className="mt-3 text-sm leading-6 text-muted">{goal.detail}</p>
              ) : null}

              {editingId === goal.id ? (
                <form
                  className="mt-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const payload = readGoalForm(event.currentTarget);
                    await run(
                      () =>
                        patchJson<GoalsResponse>(itemAction(goal.id), payload),
                      "Goal updated.",
                    );
                  }}
                >
                  <GoalFormFields
                    catalog={catalog}
                    initial={goal}
                    idPrefix={`edit-${goal.id}`}
                  />
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Button type="submit" disabled={pending}>
                      Save changes
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 flex flex-wrap gap-3">
                  {goal.status !== "completed" ? (
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            patchJson<GoalsResponse>(itemAction(goal.id), {
                              status: "completed",
                            }),
                          "Goal marked complete.",
                        )
                      }
                    >
                      Mark complete
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            patchJson<GoalsResponse>(itemAction(goal.id), {
                              status: "active",
                            }),
                          "Goal reopened.",
                        )
                      }
                    >
                      Reopen
                    </Button>
                  )}
                  {goal.status === "active" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            patchJson<GoalsResponse>(itemAction(goal.id), {
                              status: "paused",
                            }),
                          "Goal paused.",
                        )
                      }
                    >
                      Pause
                    </Button>
                  ) : null}
                  {goal.status === "paused" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            patchJson<GoalsResponse>(itemAction(goal.id), {
                              status: "active",
                            }),
                          "Goal resumed.",
                        )
                      }
                    >
                      Resume
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => setEditingId(goal.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={async () => {
                      if (!window.confirm("Remove this learning goal?")) {
                        return;
                      }
                      await run(
                        () => deleteJson<GoalsResponse>(itemAction(goal.id)),
                        "Goal removed.",
                      );
                    }}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted">
          Add a first goal so teachers know what this learner wants to work on.
        </p>
      )}

      {error ? (
        <p className="rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
    </div>
  );
}
