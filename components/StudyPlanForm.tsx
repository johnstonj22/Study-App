"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateStudyPlanAction,
  type FormState,
} from "@/app/(app)/study-plan/actions";

const INITIAL_STATE: FormState = { error: null, saved: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Saving..." : "Save"}
    </button>
  );
}

export function StudyPlanForm({ dailyQuota }: { dailyQuota: number }) {
  const [state, formAction] = useActionState(
    updateStudyPlanAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Questions per day</span>
        <input
          name="daily_quota"
          type="number"
          min={1}
          max={200}
          step={1}
          required
          defaultValue={dailyQuota}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
          Your daily review goal. When more questions are due than this, the
          calendar will spread them across the next several days.
        </span>
      </label>

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
