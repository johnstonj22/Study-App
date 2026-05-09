"use client";

import { useState } from "react";
import type { Rating, ReviewQueueItem } from "@/lib/types/domain";

const RATINGS: Array<{ value: Rating; label: string; tone: string }> = [
  {
    value: "again",
    label: "Again",
    tone: "bg-red-100 hover:bg-red-200 text-red-900 dark:bg-red-950 dark:hover:bg-red-900 dark:text-red-100",
  },
  {
    value: "hard",
    label: "Hard",
    tone: "bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-100",
  },
  {
    value: "good",
    label: "Good",
    tone: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-100",
  },
  {
    value: "easy",
    label: "Easy",
    tone: "bg-sky-100 hover:bg-sky-200 text-sky-900 dark:bg-sky-950 dark:hover:bg-sky-900 dark:text-sky-100",
  },
];

export function ReviewCard({
  item,
  pending,
  onRate,
}: {
  item: ReviewQueueItem;
  pending: boolean;
  onRate: (rating: Rating) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");

  // Reset internal state when the item changes (parent passes a new item).
  // Use the item id as the React key to force a remount instead — handled by
  // ReviewQueue. So no need to handle reset here.

  const isFlashcard = item.kind === "flashcard";

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {isFlashcard ? "Flashcard" : "Short-answer question"}
        </p>
        <p className="text-base font-medium whitespace-pre-line">
          {isFlashcard ? item.front : item.prompt}
        </p>

        {!isFlashcard && (
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Type your answer (just for your own reference — not graded)"
            rows={4}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
          />
        )}

        {revealed ? (
          <div className="space-y-1 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {isFlashcard ? "Answer" : "Expected answer"}
            </p>
            <p className="whitespace-pre-line text-sm">
              {isFlashcard
                ? item.back
                : (item.expected_answer ?? "(no reference answer)")}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Show answer
          </button>
        )}
      </div>

      {revealed && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={pending}
              onClick={() => onRate(r.value)}
              className={`rounded-md py-4 text-base font-medium transition disabled:opacity-50 sm:py-3 sm:text-sm ${r.tone}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
