import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeTopicMasteryTree,
  getAncestorChain,
  getChildTopics,
  getTopic,
  listTopics,
} from "@/lib/services/topics";
import { listFlashcardsForTopic } from "@/lib/services/flashcards";
import { listShortAnswersForTopic } from "@/lib/services/shortAnswerQuestions";
import { DeleteTopicButton } from "./delete-topic-button";
import { DeleteFlashcardButton } from "./flashcards/delete-flashcard-button";
import { DeleteShortAnswerButton } from "./short-answer/delete-short-answer-button";

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [topic, allTopics, children, flashcards, questions, masteryTree] =
    await Promise.all([
      getTopic(supabase, id),
      listTopics(supabase),
      getChildTopics(supabase, id),
      listFlashcardsForTopic(supabase, id),
      listShortAnswersForTopic(supabase, id),
      computeTopicMasteryTree(supabase),
    ]);

  if (!topic) notFound();

  const isBranch = children.length > 0;
  const hasQuestions = flashcards.length + questions.length > 0;
  const mastery = Math.round(masteryTree.map.get(topic.id) ?? 0);

  const topicsById = new Map(allTopics.map((t) => [t.id, t]));
  const ancestors = getAncestorChain(topic.id, topicsById).slice(0, -1);

  // The "Add sub-topic" entry: empty leaf → straight to the create form;
  // leaf with questions → split flow first.
  const addSubTopicHref = hasQuestions
    ? `/topics/${topic.id}/split`
    : `/topics/${topic.id}/sub-topics/new`;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/topics" className="hover:underline">
            Topics
          </Link>
          {ancestors.map((a) => (
            <span key={a.id} className="flex items-center gap-1">
              <span>/</span>
              <Link href={`/topics/${a.id}`} className="hover:underline">
                {a.title}
              </Link>
            </span>
          ))}
          <span>/</span>
          <span className="text-zinc-900 dark:text-zinc-100">{topic.title}</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{topic.title}</h1>
            {topic.category && (
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {topic.category}
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs tabular-nums dark:bg-zinc-800">
            Mastery {mastery}%
          </span>
        </div>
        {topic.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {topic.description}
          </p>
        )}
      </div>

      {isBranch ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              Sub-topics{" "}
              <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                ({children.length})
              </span>
            </h2>
            <Link
              href={`/topics/${topic.id}/sub-topics/new`}
              className="text-sm font-medium underline"
            >
              Add sub-topic
            </Link>
          </div>
          <ul className="space-y-2">
            {children.map((c) => {
              const cMastery = Math.round(masteryTree.map.get(c.id) ?? 0);
              return (
                <li key={c.id}>
                  <Link
                    href={`/topics/${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                  >
                    <span className="text-sm font-medium">{c.title}</span>
                    <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {cMastery}%
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <>
          <div className="flex items-center justify-end gap-4">
            {hasQuestions && (
              <Link
                href={`/topics/${topic.id}/move`}
                className="text-sm font-medium underline"
              >
                Move questions
              </Link>
            )}
            <Link
              href={addSubTopicHref}
              className="text-sm font-medium underline"
            >
              Add sub-topic
            </Link>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  Flashcards{" "}
                  <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                    ({flashcards.length})
                  </span>
                </h2>
                <Link
                  href={`/topics/${topic.id}/flashcards/new`}
                  className="text-sm font-medium underline"
                >
                  Add flashcard
                </Link>
              </div>

              {flashcards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  No flashcards yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {flashcards.map((fc) => {
                    const fcMastery = Math.round(Number(fc.mastery_score));
                    return (
                      <li
                        key={fc.id}
                        className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium">{fc.front}</p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                              {fc.back}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                              {fcMastery}%
                            </span>
                            <DeleteFlashcardButton
                              flashcardId={fc.id}
                              topicId={topic.id}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  Short-answer questions{" "}
                  <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                    ({questions.length})
                  </span>
                </h2>
                <Link
                  href={`/topics/${topic.id}/short-answer/new`}
                  className="text-sm font-medium underline"
                >
                  Add question
                </Link>
              </div>

              {questions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  No questions yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {questions.map((q) => {
                    const qMastery = Math.round(Number(q.mastery_score));
                    return (
                      <li
                        key={q.id}
                        className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium">{q.prompt}</p>
                            {q.expected_answer && (
                              <p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
                                {q.expected_answer}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                              {qMastery}%
                            </span>
                            <DeleteShortAnswerButton
                              questionId={q.id}
                              topicId={topic.id}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      <section className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <DeleteTopicButton id={topic.id} />
      </section>
    </div>
  );
}
