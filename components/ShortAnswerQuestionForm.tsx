"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createShortAnswerAction,
  type FormState,
} from "@/app/(app)/topics/[id]/short-answer/actions";

const INITIAL_STATE: FormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Adding..." : "Add question"}
    </button>
  );
}

export function ShortAnswerQuestionForm({ topicId }: { topicId: string }) {
  const action = createShortAnswerAction.bind(null, topicId);
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Prompt</span>
        <textarea
          name="prompt"
          required
          rows={3}
          maxLength={2000}
          placeholder="Explain how TCP handshake works."
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">
          Expected answer{" "}
          <span className="text-zinc-400">(optional, used as reference)</span>
        </span>
        <textarea
          name="expected_answer"
          rows={5}
          maxLength={4000}
          placeholder="A 3-step process: SYN, SYN-ACK, ACK..."
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </label>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
