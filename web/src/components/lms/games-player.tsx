"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import type {
  EducationalGamePlayView,
  EducationalGamePair,
} from "@/lib/games";

function tileClass(active: boolean, locked: boolean) {
  if (locked) {
    return "border-[#294634] bg-[#294634] text-white";
  }
  if (active) {
    return "border-[#CB9F64] bg-[#F3E6D0] text-[#294634]";
  }
  return "border-line bg-background text-brand";
}

export function GamesPlayer({
  play,
  pending,
  onSubmit,
}: {
  play: EducationalGamePlayView;
  pending: boolean;
  onSubmit: (input: {
    pairs?: EducationalGamePair[];
    order?: string[];
    answers?: number[];
  }) => void;
}) {
  if (play.kind === "match") {
    return <MatchPlay play={play} pending={pending} onSubmit={onSubmit} />;
  }
  if (play.kind === "memory") {
    return <MemoryPlay play={play} pending={pending} onSubmit={onSubmit} />;
  }
  if (play.kind === "order") {
    return <OrderPlay play={play} pending={pending} onSubmit={onSubmit} />;
  }
  return <ChoicePlay play={play} pending={pending} onSubmit={onSubmit} />;
}

function MatchPlay({
  play,
  pending,
  onSubmit,
}: {
  play: Extract<EducationalGamePlayView, { kind: "match" }>;
  pending: boolean;
  onSubmit: (input: { pairs?: EducationalGamePair[] }) => void;
}) {
  const t = useT();
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [pairs, setPairs] = useState<EducationalGamePair[]>([]);
  const matchedLeft = useMemo(
    () => new Set(pairs.map((pair) => pair.left)),
    [pairs],
  );
  const matchedRight = useMemo(
    () => new Set(pairs.map((pair) => pair.right)),
    [pairs],
  );

  function pickLeft(value: string) {
    if (matchedLeft.has(value) || pending) return;
    setSelectedLeft(value === selectedLeft ? null : value);
  }

  function pickRight(value: string) {
    if (!selectedLeft || matchedRight.has(value) || pending) return;
    const next = [...pairs, { left: selectedLeft, right: value }];
    setPairs(next);
    setSelectedLeft(null);
    if (next.length === play.left.length) {
      onSubmit({ pairs: next });
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ul className="grid gap-2">
        {play.left.map((item) => (
          <li key={item}>
            <button
              type="button"
              dir="auto"
              disabled={matchedLeft.has(item) || pending}
              onClick={() => pickLeft(item)}
              className={`w-full rounded-2xl border px-4 py-3 text-start text-sm font-semibold ${tileClass(selectedLeft === item, matchedLeft.has(item))}`}
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
      <ul className="grid gap-2">
        {play.right.map((item) => (
          <li key={item}>
            <button
              type="button"
              dir="auto"
              disabled={matchedRight.has(item) || pending || !selectedLeft}
              onClick={() => pickRight(item)}
              className={`w-full rounded-2xl border px-4 py-3 text-start text-sm font-semibold ${tileClass(false, matchedRight.has(item))}`}
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm font-semibold text-muted md:col-span-2">
        {t("games.match_help")}
      </p>
    </div>
  );
}

function MemoryPlay({
  play,
  pending,
  onSubmit,
}: {
  play: Extract<EducationalGamePlayView, { kind: "memory" }>;
  pending: boolean;
  onSubmit: (input: { pairs?: EducationalGamePair[] }) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [pairs, setPairs] = useState<EducationalGamePair[]>([]);
  const [busy, setBusy] = useState(false);

  function flip(id: string) {
    if (pending || busy || matched.includes(id) || open.includes(id)) return;
    const nextOpen = [...open, id];
    setOpen(nextOpen);
    if (nextOpen.length < 2) return;
    const first = play.cards.find((card) => card.id === nextOpen[0]);
    const second = play.cards.find((card) => card.id === nextOpen[1]);
    if (!first || !second) return;
    if (first.pairId === second.pairId) {
      const nextMatched = [...matched, first.id, second.id];
      const nextPairs = [
        ...pairs,
        { left: first.text, right: second.text },
      ];
      setMatched(nextMatched);
      setPairs(nextPairs);
      setOpen([]);
      if (nextMatched.length === play.cards.length) {
        onSubmit({ pairs: nextPairs });
      }
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      setOpen([]);
      setBusy(false);
    }, 700);
  }

  return (
    <div>
      <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
        {play.cards.map((card) => {
          const shown = open.includes(card.id) || matched.includes(card.id);
          return (
            <li key={card.id}>
              <button
                type="button"
                dir="auto"
                disabled={pending || busy}
                onClick={() => flip(card.id)}
                className={`flex min-h-24 w-full items-center justify-center rounded-2xl border px-3 py-4 text-center text-sm font-semibold ${tileClass(open.includes(card.id), matched.includes(card.id))}`}
              >
                {shown ? card.text : t("games.hidden")}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm font-semibold text-muted">{t("games.memory_help")}</p>
    </div>
  );
}

function OrderPlay({
  play,
  pending,
  onSubmit,
}: {
  play: Extract<EducationalGamePlayView, { kind: "order" }>;
  pending: boolean;
  onSubmit: (input: { order?: string[] }) => void;
}) {
  const t = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const remaining = play.items.filter((item) => !picked.includes(item));

  return (
    <div>
      {play.prompt ? (
        <p className="mb-3 text-sm font-semibold text-brand" dir="auto">
          {play.prompt}
        </p>
      ) : null}
      <ol className="mb-4 grid gap-2">
        {picked.map((item, index) => (
          <li
            key={`${item}-${index}`}
            dir="auto"
            className="rounded-2xl border border-[#294634] bg-[#294634] px-4 py-3 text-sm font-semibold text-white"
          >
            {index + 1}. {item}
          </li>
        ))}
      </ol>
      <ul className="grid gap-2 sm:grid-cols-2">
        {remaining.map((item) => (
          <li key={item}>
            <button
              type="button"
              dir="auto"
              disabled={pending}
              onClick={() => setPicked((current) => [...current, item])}
              className={`w-full rounded-2xl border px-4 py-3 text-start text-sm font-semibold ${tileClass(false, false)}`}
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={!picked.length || pending}
          onClick={() => setPicked((current) => current.slice(0, -1))}
        >
          {t("games.undo")}
        </Button>
        <Button
          type="button"
          disabled={remaining.length > 0 || pending}
          onClick={() => onSubmit({ order: picked })}
        >
          {t("games.check")}
        </Button>
      </div>
    </div>
  );
}

function ChoicePlay({
  play,
  pending,
  onSubmit,
}: {
  play: Extract<EducationalGamePlayView, { kind: "choice" }>;
  pending: boolean;
  onSubmit: (input: { answers?: number[] }) => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const question = play.questions[index];
  if (!question) return null;
  const chosen = answers[index];

  function pick(choiceIndex: number) {
    if (pending) return;
    const next = [...answers];
    next[index] = choiceIndex;
    setAnswers(next);
  }

  return (
    <div>
      <p className="text-sm font-semibold text-muted">
        {t("games.question_of", {
          current: index + 1,
          total: play.questions.length,
        })}
      </p>
      <p className="mt-2 font-heading text-xl font-bold tracking-tight text-brand" dir="auto">
        {question.prompt}
      </p>
      <ul className="mt-4 grid gap-2">
        {question.choices.map((choice, choiceIndex) => (
          <li key={`${choice}-${choiceIndex}`}>
            <button
              type="button"
              dir="auto"
              disabled={pending}
              onClick={() => pick(choiceIndex)}
              className={`w-full rounded-2xl border px-4 py-3 text-start text-sm font-semibold ${tileClass(chosen === choiceIndex, false)}`}
            >
              {choice}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-3">
        {index < play.questions.length - 1 ? (
          <Button
            type="button"
            disabled={chosen === undefined || pending}
            onClick={() => setIndex((current) => current + 1)}
          >
            {t("games.next")}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={chosen === undefined || pending}
            onClick={() => onSubmit({ answers })}
          >
            {t("games.check")}
          </Button>
        )}
      </div>
    </div>
  );
}
