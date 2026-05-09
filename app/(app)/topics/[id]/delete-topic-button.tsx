"use client";

import { useState, useTransition } from "react";
import { deleteTopicAction } from "../actions";

export function DeleteTopicButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (
      !confirm(
        "Delete this topic? All flashcards and questions under it will also be deleted.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteTopicAction(id);
      } catch (err) {
        if (err instanceof Error && err.message === "NEXT_REDIRECT") return;
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
        className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
      >
        {pending ? "Deleting..." : "Delete topic"}
      </button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
