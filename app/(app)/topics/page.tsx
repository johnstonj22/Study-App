import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  computeTopicMasteryTree,
  getTopicTree,
} from "@/lib/services/topics";
import { TopicTreeList } from "@/components/TopicTreeList";

export default async function TopicsPage() {
  const supabase = await createClient();
  const [tree, mastery] = await Promise.all([
    getTopicTree(supabase),
    computeTopicMasteryTree(supabase),
  ]);

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

      {tree.length === 0 ? (
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
        <TopicTreeList nodes={tree} masteryMap={mastery.map} />
      )}
    </div>
  );
}
