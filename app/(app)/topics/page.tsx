import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listTopics } from "@/lib/services/topics";
import { TopicCard } from "@/components/TopicCard";

export default async function TopicsPage() {
  const supabase = await createClient();
  const topics = await listTopics(supabase);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Topics</h1>
        <Link
          href="/topics/new"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New topic
        </Link>
      </div>

      {topics.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            You don&apos;t have any topics yet.
          </p>
          <Link
            href="/topics/new"
            className="mt-3 inline-block text-sm font-medium underline"
          >
            Create your first topic
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
