import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getLeafTopics,
  getTopic,
  topicHasChildren,
} from "@/lib/services/topics";
import { listFlashcardsForTopic } from "@/lib/services/flashcards";
import { listShortAnswersForTopic } from "@/lib/services/shortAnswerQuestions";
import { MoveQuestionsForm } from "@/components/MoveQuestionsForm";

export default async function MoveQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const topic = await getTopic(supabase, id);
  if (!topic) notFound();

  // Branches don't own questions, so this page makes no sense for them.
  if (await topicHasChildren(supabase, id)) {
    redirect(`/topics/${id}`);
  }

  const [flashcards, questions, leafTargets] = await Promise.all([
    listFlashcardsForTopic(supabase, id),
    listShortAnswersForTopic(supabase, id),
    getLeafTopics(supabase, id),
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
        <h1 className="text-xl font-semibold">Move questions</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pick a destination topic and check the questions you want to move.
        </p>
      </div>

      {flashcards.length === 0 && questions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          This topic has no questions to move.
        </p>
      ) : leafTargets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          You don&apos;t have another leaf topic to move questions into. Create
          one first.
        </p>
      ) : (
        <MoveQuestionsForm
          sourceTopicId={topic.id}
          targets={leafTargets.map((t) => ({ id: t.id, title: t.title }))}
          flashcards={flashcards.map((f) => ({ id: f.id, front: f.front }))}
          shortAnswers={questions.map((q) => ({ id: q.id, prompt: q.prompt }))}
        />
      )}
    </div>
  );
}
