import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTopic } from "@/lib/services/topics";
import { FlashcardForm } from "@/components/FlashcardForm";

export default async function NewFlashcardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const topic = await getTopic(supabase, id);
  if (!topic) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          href={`/topics/${topic.id}`}
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          ← {topic.title}
        </Link>
        <h1 className="text-xl font-semibold">New flashcard</h1>
      </div>
      <FlashcardForm topicId={topic.id} />
    </div>
  );
}
