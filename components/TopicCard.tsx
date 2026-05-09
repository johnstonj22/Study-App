import Link from "next/link";
import type { Topic } from "@/lib/types/domain";

export function TopicCard({ topic }: { topic: Topic }) {
  const mastery = Math.round(Number(topic.mastery_score));
  return (
    <Link
      href={`/topics/${topic.id}`}
      className="block rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">{topic.title}</h3>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {mastery}%
        </span>
      </div>
      {topic.category && (
        <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {topic.category}
        </p>
      )}
      {topic.description && (
        <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">
          {topic.description}
        </p>
      )}
    </Link>
  );
}
