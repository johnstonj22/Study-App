import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDueQueue } from "@/lib/services/reviews";
import { ReviewQueue } from "@/components/ReviewQueue";

export default async function ReviewPage() {
  const supabase = await createClient();
  const items = await getDueQueue(supabase, new Date());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Review</h1>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nothing is due right now.
          </p>
          <Link
            href="/topics"
            className="mt-3 inline-block text-sm font-medium underline"
          >
            Add more flashcards or questions
          </Link>
        </div>
      ) : (
        <ReviewQueue initialItems={items} />
      )}
    </div>
  );
}
