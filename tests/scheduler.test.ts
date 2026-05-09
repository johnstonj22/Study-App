import { describe, it, expect } from "vitest";
import { calculateReviewUpdate } from "../lib/scheduler";
import type { Rating } from "../lib/types/domain";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60_000;
}

describe("calculateReviewUpdate — interval per rating", () => {
  const cases: Array<[Rating, number]> = [
    ["again", 10],
    ["hard", 60 * 24],
    ["good", 60 * 24 * 3],
    ["easy", 60 * 24 * 7],
  ];

  it.each(cases)("%s schedules %d minutes out", (rating, expected) => {
    const result = calculateReviewUpdate(50, rating, NOW);
    expect(minutesBetween(NOW, result.next_review_at)).toBe(expected);
  });
});

describe("calculateReviewUpdate — mastery delta", () => {
  const cases: Array<[Rating, number, number]> = [
    // [rating, starting mastery, expected new mastery]
    ["again", 50, 35],
    ["hard", 50, 52],
    ["good", 50, 58],
    ["easy", 50, 65],
  ];

  it.each(cases)(
    "%s on mastery %d -> %d",
    (rating, current, expected) => {
      const result = calculateReviewUpdate(current, rating, NOW);
      expect(result.mastery_score).toBe(expected);
    },
  );

  it("clamps mastery at 0", () => {
    const result = calculateReviewUpdate(0, "again", NOW);
    expect(result.mastery_score).toBe(0);
  });

  it("clamps mastery at 100", () => {
    const result = calculateReviewUpdate(100, "easy", NOW);
    expect(result.mastery_score).toBe(100);
  });
});

describe("calculateReviewUpdate — last_reviewed_at", () => {
  it("is set to the provided `now` for every rating", () => {
    for (const rating of ["again", "hard", "good", "easy"] as const) {
      const result = calculateReviewUpdate(50, rating, NOW);
      expect(result.last_reviewed_at.getTime()).toBe(NOW.getTime());
    }
  });
});
