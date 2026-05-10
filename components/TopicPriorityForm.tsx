"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateTopicPrioritiesAction,
  type FormState,
} from "@/app/(app)/study-plan/actions";
import type { Topic } from "@/lib/types/domain";

const INITIAL_STATE: FormState = { error: null, saved: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Saving..." : "Save priorities"}
    </button>
  );
}

export function TopicPriorityForm({ topics }: { topics: Topic[] }) {
  const [state, formAction] = useActionState(
    updateTopicPrioritiesAction,
    INITIAL_STATE,
  );

  if (topics.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Create a topic to start setting priorities.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Lower number = higher priority. Items from priority-1 topics are
        scheduled (and shown in the queue) before priority-2, and so on.
        Topics sharing the same number split evenly within their tier.
      </p>

      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {topics.map((topic) => (
          <li
            key={topic.id}
            className="flex items-center justify-between gap-4 px-3 py-2"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-sm font-medium">{topic.title}</p>
              {topic.category && (
                <p className="truncate text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {topic.category}
                </p>
              )}
            </div>
            <input
              name={`priority_${topic.id}`}
              type="number"
              min={1}
              max={99}
              step={1}
              required
              defaultValue={topic.priority}
              className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
              aria-label={`Priority for ${topic.title}`}
            />
          </li>
        ))}
      </ul>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Saved.
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
