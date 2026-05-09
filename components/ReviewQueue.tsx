"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { rateItemAction } from "@/app/(app)/review/actions";
import type { Rating, ReviewQueueItem } from "@/lib/types/domain";
import { ReviewCard } from "./ReviewCard";

export function ReviewQueue({
  initialItems,
}: {
  initialItems: ReviewQueueItem[];
}) {
  const [items] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = items.length;
  const current = items[index];
  const done = index >= total;

  function handleRate(rating: Rating) {
    if (!current) return;
    setError(null);
    const itemType = current.kind;
    const itemId = current.id;
    startTransition(async () => {
      try {
        await rateItemAction(itemType, itemId, rating);
        setIndex((i) => i + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record review");
      }
    });
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">All done</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          You reviewed {total} item{total === 1 ? "" : "s"}. Nice work.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Back to dashboard
          </Link>
          <Link
            href="/review"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Refresh queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>
          Item {index + 1} of {total}
        </span>
        {pending && <span>Saving...</span>}
      </div>

      {/* key forces a fresh ReviewCard mount per item, resetting reveal state */}
      <ReviewCard
        key={current!.id}
        item={current!}
        pending={pending}
        onRate={handleRate}
      />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
