"use client";

import { useState, useTransition } from "react";
import { deleteFlashcardAction } from "./actions";

export function DeleteFlashcardButton({
  flashcardId,
  topicId,
}: {
  flashcardId: string;
  topicId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm("Delete this flashcard?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteFlashcardAction(flashcardId, topicId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
      >
        {pending ? "Deleting..." : "Delete"}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
