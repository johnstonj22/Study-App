import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTopic, topicHasQuestions } from "@/lib/services/topics";
import { listFlashcardsForTopic } from "@/lib/services/flashcards";
import { listShortAnswersForTopic } from "@/lib/services/shortAnswerQuestions";
import { SubTopicSplitForm } from "@/components/SubTopicSplitForm";

export default async function SplitTopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const topic = await getTopic(supabase, id);
  if (!topic) notFound();

  // No questions means there's nothing to split — fall through to the
  // simple sub-topic create page.
  if (!(await topicHasQuestions(supabase, id))) {
    redirect(`/topics/${id}/sub-topics/new`);
  }

  const [flashcards, questions] = await Promise.all([
    listFlashcardsForTopic(supabase, id),
    listShortAnswersForTopic(supabase, id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link
          href={`/topics/${topic.id}`}
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          ← {topic.title}
        </Link>
        <h1 className="text-xl font-semibold">Split into sub-topics</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Adding sub-topics under{" "}
          <span className="font-medium">{topic.title}</span> requires moving its
          existing questions into the new sub-topics. Name your sub-topics on
          the left, then assign each question on the right.
        </p>
      </div>
      <SubTopicSplitForm
        parentTopicId={topic.id}
        flashcards={flashcards.map((f) => ({ id: f.id, front: f.front }))}
        shortAnswers={questions.map((q) => ({ id: q.id, prompt: q.prompt }))}
      />
    </div>
  );
}
