"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createTopicAction, type FormState } from "@/app/(app)/topics/actions";

const INITIAL_STATE: FormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Creating..." : "Create topic"}
    </button>
  );
}

export function CreateTopicForm() {
  const [state, formAction] = useActionState(createTopicAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Title</span>
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder="e.g. Networking fundamentals"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">
          Category <span className="text-zinc-400">(optional)</span>
        </span>
        <input
          name="category"
          type="text"
          maxLength={100}
          placeholder="e.g. Computer science"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">
          Description <span className="text-zinc-400">(optional)</span>
        </span>
        <textarea
          name="description"
          rows={4}
          maxLength={2000}
          placeholder="What is this topic about? Why do you want to maintain it?"
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
