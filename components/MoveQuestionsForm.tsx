"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  moveQuestionsAction,
  type FormState,
} from "@/app/(app)/topics/actions";

const INITIAL_STATE: FormState = { error: null };

type FlashcardLite = { id: string; front: string };
type ShortAnswerLite = { id: string; prompt: string };
type Target = { id: string; title: string };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Moving..." : "Move questions"}
    </button>
  );
}

export function MoveQuestionsForm({
  sourceTopicId,
  targets,
  flashcards,
  shortAnswers,
}: {
  sourceTopicId: string;
  targets: Target[];
  flashcards: FlashcardLite[];
  shortAnswers: ShortAnswerLite[];
}) {
  const action = moveQuestionsAction.bind(null, sourceTopicId);
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  const [target, setTarget] = useState("");
  const [checkedFc, setCheckedFc] = useState<Set<string>>(new Set());
  const [checkedSa, setCheckedSa] = useState<Set<string>>(new Set());

  const toggle = (
    set: Set<string>,
    setSet: (s: Set<string>) => void,
    id: string,
  ) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  };

  const totalChecked = checkedFc.size + checkedSa.size;
  const canSubmit = target !== "" && totalChecked > 0;

  return (
    <form action={formAction} className="space-y-6">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Move to</span>
        <select
          name="target_topic_id"
          required
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">— choose a topic —</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Questions</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {totalChecked} selected
          </span>
        </div>

        <ul className="space-y-2">
          {flashcards.map((fc) => (
            <li
              key={`fc-${fc.id}`}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name={`move_flashcard_${fc.id}`}
                  checked={checkedFc.has(fc.id)}
                  onChange={() => toggle(checkedFc, setCheckedFc, fc.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="inline-block rounded-sm bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    Flashcard
                  </span>
                  <p className="truncate text-sm">{fc.front}</p>
                </div>
              </label>
            </li>
          ))}
          {shortAnswers.map((q) => (
            <li
              key={`sa-${q.id}`}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name={`move_short_answer_${q.id}`}
                  checked={checkedSa.has(q.id)}
                  onChange={() => toggle(checkedSa, setCheckedSa, q.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="inline-block rounded-sm bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    Short answer
                  </span>
                  <p className="truncate text-sm">{q.prompt}</p>
                </div>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <SubmitButton disabled={!canSubmit} />
    </form>
  );
}
