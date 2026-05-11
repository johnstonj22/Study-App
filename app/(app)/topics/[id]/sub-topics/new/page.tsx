import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTopic, topicHasQuestions } from "@/lib/services/topics";
import { CreateTopicForm } from "@/components/CreateTopicForm";

export default async function NewSubTopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const topic = await getTopic(supabase, id);
  if (!topic) notFound();

  // If the parent still has questions, redirect into the split flow — the
  // service would reject the create otherwise.
  if (await topicHasQuestions(supabase, id)) {
    redirect(`/topics/${id}/split`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          href={`/topics/${topic.id}`}
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          ← {topic.title}
        </Link>
        <h1 className="text-xl font-semibold">New sub-topic</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Will be created under <span className="font-medium">{topic.title}</span>.
        </p>
      </div>
      <CreateTopicForm parentId={topic.id} />
    </div>
  );
}
