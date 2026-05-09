// Placeholder scheduler. Pure logic, no I/O, no framework imports.
//
// Fixed intervals per rating; no ease factor, no repetition tracking.
// Intended to be replaced with a richer SM-2 / FSRS-style scheduler later.
// The flashcards / short_answer_questions tables already carry
// ease_factor / interval_days / repetitions columns for that future work.

import type { Rating } from "./types/domain";

export interface SchedulingUpdate {
  mastery_score: number;
  last_reviewed_at: Date;
  next_review_at: Date;
}

const MASTERY_DELTA: Record<Rating, number> = {
  again: -15,
  hard: 2,
  good: 8,
  easy: 15,
};

const INTERVAL_MINUTES: Record<Rating, number> = {
  again: 10,
  hard: 60 * 24,        //  1 day
  good: 60 * 24 * 3,    //  3 days
  easy: 60 * 24 * 7,    //  7 days
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function calculateReviewUpdate(
  currentMasteryScore: number,
  rating: Rating,
  now: Date = new Date(),
): SchedulingUpdate {
  const newMasteryScore = clamp(
    currentMasteryScore + MASTERY_DELTA[rating],
    0,
    100,
  );
  const nextReviewAt = new Date(
    now.getTime() + INTERVAL_MINUTES[rating] * 60_000,
  );
  return {
    mastery_score: newMasteryScore,
    last_reviewed_at: now,
    next_review_at: nextReviewAt,
  };
}
