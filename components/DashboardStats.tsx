import Link from "next/link";
import type { Topic } from "@/lib/types/domain";

export function DashboardStats({
  dueToday,
  dailyQuota,
  completedToday,
  recentTopics,
  weakestTopics,
  hasAnyTopics,
}: {
  dueToday: number;
  dailyQuota: number;
  completedToday: number;
  recentTopics: Topic[];
  weakestTopics: Topic[];
  hasAnyTopics: boolean;
}) {
  if (!hasAnyTopics) {
    return (
      <div className="space-y-4 rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <h2 className="text-lg font-semibold">Welcome to your study app</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Create your first topic to start adding flashcards and questions.
        </p>
        <Link
          href="/topics/new"
          className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Create your first topic
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Today
          </p>
          <p className="text-3xl font-semibold tabular-nums">
            {completedToday} / {completedToday + dueToday}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {dueToday === 0
              ? completedToday >= dailyQuota
                ? "Daily goal complete."
                : "You're all caught up."
              : `${dueToday} left of your ${dailyQuota}/day goal`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dueToday > 0 ? (
            <Link
              href="/review"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Start review
            </Link>
          ) : (
            <span
              aria-disabled
              className="cursor-not-allowed rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
            >
              Start review
            </span>
          )}
          <Link
            href="/topics/new"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Create topic
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <TopicList
          title="Weakest topics"
          subtitle="Lowest mastery first"
          topics={weakestTopics}
          emptyMessage="No topics to rank yet."
        />
        <TopicList
          title="Recently updated"
          subtitle="Most recent edits first"
          topics={recentTopics}
          emptyMessage="No recent topic edits."
        />
      </div>
    </div>
  );
}

function TopicList({
  title,
  subtitle,
  topics,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  topics: Topic[];
  emptyMessage: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>
      {topics.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {topics.map((topic) => {
            const mastery = Math.round(Number(topic.mastery_score));
            return (
              <li key={topic.id}>
                <Link
                  href={`/topics/${topic.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">{topic.title}</p>
                    {topic.category && (
                      <p className="truncate text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {topic.category}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {mastery}%
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
