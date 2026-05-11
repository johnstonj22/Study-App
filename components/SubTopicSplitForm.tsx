"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  convertLeafToBranchAction,
  type FormState,
} from "@/app/(app)/topics/actions";

const INITIAL_STATE: FormState = { error: null };

type FlashcardLite = { id: string; front: string };
type ShortAnswerLite = { id: string; prompt: string };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Splitting..." : "Split into sub-topics"}
    </button>
  );
}

export function SubTopicSplitForm({
  parentTopicId,
  flashcards,
  shortAnswers,
}: {
  parentTopicId: string;
  flashcards: FlashcardLite[];
  shortAnswers: ShortAnswerLite[];
}) {
  const action = convertLeafToBranchAction.bind(null, parentTopicId);
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  // Sub-topic rows. We track an internal incrementing id only so React keys
  // stay stable when rows are added/removed mid-edit. The submitted index
  // (in the field name) is the array position at submit time.
  const [rows, setRows] = useState<Array<{ key: number; title: string }>>([
    { key: 0, title: "" },
    { key: 1, title: "" },
  ]);
  const [nextKey, setNextKey] = useState(2);

  const addRow = () => {
    setRows((rs) => [...rs, { key: nextKey, title: "" }]);
    setNextKey((k) => k + 1);
  };
  const removeRow = (key: number) => {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  };
  const setTitle = (key: number, title: string) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, title } : r)));
  };

  // Options the question selects show. The value submitted is the row's
  // current array index, matching what the server action expects.
  const options = rows.map((r, i) => ({
    value: String(i),
    label: r.title.trim() === "" ? `Sub-topic ${i + 1}` : r.title,
  }));

  // Block submission until every row has a title (mirrors server validation).
  const allTitled = rows.every((r) => r.title.trim().length > 0);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">New sub-topics</h2>
            <button
              type="button"
              onClick={addRow}
              className="text-sm font-medium underline"
            >
              Add another
            </button>
          </div>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.key} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  #{i + 1}
                </span>
                <input
                  name={`subtopic_${i}_title`}
                  type="text"
                  required
                  maxLength={200}
                  value={r.title}
                  onChange={(e) => setTitle(r.key, e.target.value)}
                  placeholder="e.g. TCP details"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => removeRow(r.key)}
                  disabled={rows.length <= 1}
                  className="text-xs text-zinc-500 hover:text-red-600 disabled:opacity-30 dark:text-zinc-400"
                  aria-label={`Remove sub-topic ${i + 1}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Assign questions</h2>
          {flashcards.length === 0 && shortAnswers.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No questions to assign.
            </p>
          ) : (
            <ul className="space-y-2">
              {flashcards.map((fc) => (
                <li
                  key={`fc-${fc.id}`}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="inline-block rounded-sm bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Flashcard
                      </span>
                      <p className="truncate text-sm">{fc.front}</p>
                    </div>
                    <select
                      name={`assign_flashcard_${fc.id}`}
                      defaultValue=""
                      className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="">— choose —</option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
              {shortAnswers.map((q) => (
                <li
                  key={`sa-${q.id}`}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="inline-block rounded-sm bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Short answer
                      </span>
                      <p className="truncate text-sm">{q.prompt}</p>
                    </div>
                    <select
                      name={`assign_short_answer_${q.id}`}
                      defaultValue=""
                      className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="">— choose —</option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <SubmitButton disabled={!allTitled} />
    </form>
  );
}
