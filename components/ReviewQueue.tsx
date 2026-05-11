"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { rateItemAction } from "@/app/(app)/review/actions";
import type { Rating, ReviewQueueItem } from "@/lib/types/domain";
import { ReviewCard } from "./ReviewCard";

type Phase = "goal" | "goal-complete" | "bonus" | "all-done";

export function ReviewQueue({
  goalItems,
  bonusItems,
  completedToday,
  dailyQuota,
  topicPaths,
}: {
  goalItems: ReviewQueueItem[];
  bonusItems: ReviewQueueItem[];
  completedToday: number;
  dailyQuota: number;
  topicPaths: Map<string, string>;
}) {
  const [goal] = useState(goalItems);
  const [bonus] = useState(bonusItems);
  const [phase, setPhase] = useState<Phase>(
    goal.length === 0 ? "goal-complete" : "goal",
  );
  const [goalIndex, setGoalIndex] = useState(0);
  const [bonusIndex, setBonusIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const current =
    phase === "goal"
      ? goal[goalIndex]
      : phase === "bonus"
        ? bonus[bonusIndex]
        : undefined;

  function handleRate(rating: Rating) {
    if (!current) return;
    setError(null);
    const itemType = current.kind;
    const itemId = current.id;
    startTransition(async () => {
      try {
        await rateItemAction(itemType, itemId, rating);
        if (phase === "goal") {
          const nextIdx = goalIndex + 1;
          setGoalIndex(nextIdx);
          if (nextIdx >= goal.length) {
            setPhase("goal-complete");
          }
        } else if (phase === "bonus") {
          const nextIdx = bonusIndex + 1;
          setBonusIndex(nextIdx);
          if (nextIdx >= bonus.length) setPhase("all-done");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record review");
      }
    });
  }

  if (phase === "goal-complete") {
    // `completedToday` is a live prop: each rateItemAction call revalidates
    // /review, and the re-render flows the latest review_history count back
    // in. So it already includes everything we just rated — don't add
    // goal.length on top or we double-count.
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold">Daily goal complete</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          You&rsquo;ve reviewed {completedToday} of {dailyQuota} today. Nice work.
        </p>
        {bonus.length > 0 ? (
          <>
            <p className="text-sm">
              {bonus.length} more {bonus.length === 1 ? "item is" : "items are"}{" "}
              still in the queue. Want to keep going?
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setPhase("bonus")}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Continue with {bonus.length} more
              </button>
              <Link
                href="/dashboard"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Stop for today
              </Link>
            </div>
          </>
        ) : (
          <Link
            href="/dashboard"
            className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Back to dashboard
          </Link>
        )}
      </div>
    );
  }

  if (phase === "all-done") {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold">Queue empty</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          You reviewed {completedToday} item{completedToday === 1 ? "" : "s"}{" "}
          today. Calendar is updated.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/calendar"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            View calendar
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isBonus = phase === "bonus";
  const total = isBonus ? bonus.length : goal.length;
  const index = isBonus ? bonusIndex : goalIndex;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>
          {isBonus ? "Bonus " : ""}Item {index + 1} of {total}
          {isBonus ? "" : ` · ${dailyQuota}/day goal`}
        </span>
        {pending && <span>Saving...</span>}
      </div>

      {/* key forces a fresh ReviewCard mount per item, resetting reveal state */}
      <ReviewCard
        key={current!.id}
        item={current!}
        pending={pending}
        onRate={handleRate}
        topicPath={topicPaths.get(current!.topic_id) ?? ""}
      />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
