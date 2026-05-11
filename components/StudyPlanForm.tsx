"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateStudyPlanAction,
  type FormState,
} from "@/app/(app)/study-plan/actions";

const INITIAL_STATE: FormState = { error: null, saved: false };

const DOW_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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

export function StudyPlanForm({
  dailyQuota,
  weeklySkipDays,
  weeklyQuotas,
}: {
  dailyQuota: number;
  // Day-of-week ints (0=Sun .. 6=Sat) the user has marked as skip.
  weeklySkipDays: number[];
  // Sparse map: { "<dow>": <quota> }; missing keys mean "use daily_quota".
  weeklyQuotas: Record<string, number>;
}) {
  const [state, formAction] = useActionState(
    updateStudyPlanAction,
    INITIAL_STATE,
  );

  const [quota, setQuota] = useState<number>(dailyQuota);
  const [skip, setSkip] = useState<Set<number>>(new Set(weeklySkipDays));
  // Per-dow string state so the input can be temporarily empty / blank means
  // "fall back to daily_quota". Initialize each dow either to its override
  // or to the global daily_quota for visibility.
  const [perDay, setPerDay] = useState<string[]>(() =>
    Array.from({ length: 7 }, (_, i) =>
      weeklyQuotas[String(i)] !== undefined
        ? String(weeklyQuotas[String(i)])
        : String(dailyQuota),
    ),
  );

  const toggleSkip = (dow: number) => {
    const next = new Set(skip);
    if (next.has(dow)) next.delete(dow);
    else next.add(dow);
    setSkip(next);
  };
  const setDay = (dow: number, val: string) => {
    setPerDay((arr) => arr.map((v, i) => (i === dow ? val : v)));
  };

  return (
    <form action={formAction} className="space-y-6">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Default questions per day</span>
        <input
          name="daily_quota"
          type="number"
          min={1}
          max={200}
          step={1}
          required
          value={quota}
          onChange={(e) => setQuota(Number(e.target.value))}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
          Default for any weekday you don&apos;t override below.
        </span>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Weekly schedule</legend>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Skip a day every week, or set a different quota for it. Leave a quota
          equal to your default to keep that day on the default.
        </p>
        <ul className="space-y-1">
          {DOW_LABELS.map((label, dow) => {
            const skipped = skip.has(dow);
            return (
              <li
                key={dow}
                className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span className="w-24 text-sm">{label}</span>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    name={`skip_${dow}`}
                    checked={skipped}
                    onChange={() => toggleSkip(dow)}
                  />
                  <span>Skip</span>
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    name={`quota_${dow}`}
                    value={perDay[dow]}
                    disabled={skipped}
                    onChange={(e) => setDay(dow, e.target.value)}
                    className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    /day
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </fieldset>

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
