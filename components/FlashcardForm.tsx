"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createFlashcardAction,
  type FormState,
} from "@/app/(app)/topics/[id]/flashcards/actions";

const INITIAL_STATE: FormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Adding..." : "Add flashcard"}
    </button>
  );
}

export function FlashcardForm({ topicId }: { topicId: string }) {
  const action = createFlashcardAction.bind(null, topicId);
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Front (question or cue)</span>
        <textarea
          name="front"
          required
          rows={3}
          maxLength={2000}
          placeholder="What does TCP stand for?"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Back (answer)</span>
        <textarea
          name="back"
          required
          rows={3}
          maxLength={2000}
          placeholder="Transmission Control Protocol"
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
