import { describe, it, expect } from "vitest";
import {
  distributeAcrossDays,
  formatDateKey,
  interleaveByType,
  orderForBonus,
} from "../lib/scheduler";
import type { ReviewQueueItem } from "../lib/types/domain";

const TZ = "UTC";
const START = new Date("2026-05-09T00:00:00.000Z");

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `id-${idCounter}`;
}

function makeFlashcard(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    kind: "flashcard",
    id: nextId(),
    user_id: "u",
    topic_id: "topic-a",
    front: "f",
    back: "b",
    difficulty: "normal",
    mastery_score: 0,
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    last_reviewed_at: null,
    next_review_at: START.toISOString(),
    created_at: START.toISOString(),
    updated_at: START.toISOString(),
    ...(overrides as object),
  } as ReviewQueueItem;
}

function makeShort(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    kind: "short_answer",
    id: nextId(),
    user_id: "u",
    topic_id: "topic-a",
    prompt: "p",
    expected_answer: "e",
    mastery_score: 0,
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    last_reviewed_at: null,
    next_review_at: START.toISOString(),
    created_at: START.toISOString(),
    updated_at: START.toISOString(),
    ...(overrides as object),
  } as ReviewQueueItem;
}

const PREFS = (quotas: number[]) => ({
  dailyQuotas: quotas,
  flashcardRatio: 0.5,
});

describe("distributeAcrossDays — basic shape", () => {
  it("returns a bucket per day with the expected dates", () => {
    const buckets = distributeAcrossDays([], START, 3, PREFS([5, 5, 5]), TZ);
    expect(buckets).toHaveLength(3);
    expect(buckets[0]!.date).toBe("2026-05-09");
    expect(buckets[1]!.date).toBe("2026-05-10");
    expect(buckets[2]!.date).toBe("2026-05-11");
    expect(buckets.every((b) => b.items.length === 0)).toBe(true);
  });

  it("throws when dailyQuotas length doesn't match numDays", () => {
    expect(() =>
      distributeAcrossDays([], START, 3, PREFS([5, 5]), TZ),
    ).toThrow();
  });
});

describe("distributeAcrossDays — quota distribution", () => {
  it("spreads a backlog evenly across days at the daily quota", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      i % 2 === 0
        ? makeFlashcard({ topic_id: `t-${i % 3}` })
        : makeShort({ topic_id: `t-${i % 3}` }),
    );
    const buckets = distributeAcrossDays(
      items,
      START,
      3,
      PREFS([10, 10, 10]),
      TZ,
    );
    expect(buckets.map((b) => b.items.length)).toEqual([10, 10, 10]);
  });

  it("respects today's reduced quota when caller has already completed work", () => {
    const items = Array.from({ length: 20 }, () => makeFlashcard());
    const buckets = distributeAcrossDays(
      items,
      START,
      3,
      PREFS([3, 10, 10]),
      TZ,
    );
    expect(buckets[0]!.items).toHaveLength(3);
    expect(buckets[1]!.items).toHaveLength(10);
    expect(buckets[2]!.items).toHaveLength(7);
  });

  it("returns empty buckets when input is empty", () => {
    const buckets = distributeAcrossDays([], START, 5, PREFS([10, 10, 10, 10, 10]), TZ);
    expect(buckets.every((b) => b.items.length === 0)).toBe(true);
  });

  it("doesn't allocate items whose next_review_at is after the day", () => {
    const eligibleNow = makeFlashcard({ next_review_at: START.toISOString() });
    const future = makeFlashcard({
      next_review_at: new Date(
        START.getTime() + 2 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
    const buckets = distributeAcrossDays(
      [eligibleNow, future],
      START,
      3,
      PREFS([10, 10, 10]),
      TZ,
    );
    expect(buckets[0]!.items).toEqual([eligibleNow]);
    expect(buckets[1]!.items).toEqual([]);
    expect(buckets[2]!.items).toEqual([future]);
  });
});

describe("distributeAcrossDays — type balance", () => {
  it("splits 50/50 by default when both types are available", () => {
    const items = [
      ...Array.from({ length: 10 }, () => makeFlashcard()),
      ...Array.from({ length: 10 }, () => makeShort()),
    ];
    const buckets = distributeAcrossDays(items, START, 1, PREFS([10]), TZ);
    const todays = buckets[0]!.items;
    expect(todays.filter((i) => i.kind === "flashcard")).toHaveLength(5);
    expect(todays.filter((i) => i.kind === "short_answer")).toHaveLength(5);
  });

  it("fills entirely from the available type when only one is present", () => {
    const items = Array.from({ length: 8 }, () => makeFlashcard());
    const buckets = distributeAcrossDays(items, START, 1, PREFS([8]), TZ);
    expect(buckets[0]!.items).toHaveLength(8);
    expect(buckets[0]!.items.every((i) => i.kind === "flashcard")).toBe(true);
  });

  it("redistributes type leftover when one type is short on supply", () => {
    const items = [
      ...Array.from({ length: 8 }, () => makeFlashcard()),
      ...Array.from({ length: 2 }, () => makeShort()),
    ];
    const buckets = distributeAcrossDays(items, START, 1, PREFS([10]), TZ);
    expect(buckets[0]!.items).toHaveLength(10);
    expect(buckets[0]!.items.filter((i) => i.kind === "flashcard")).toHaveLength(8);
    expect(buckets[0]!.items.filter((i) => i.kind === "short_answer")).toHaveLength(2);
  });
});

describe("distributeAcrossDays — topic balance", () => {
  it("splits evenly across topics by default", () => {
    const items = [
      ...Array.from({ length: 10 }, () => makeFlashcard({ topic_id: "t-a" })),
      ...Array.from({ length: 10 }, () => makeFlashcard({ topic_id: "t-b" })),
    ];
    const buckets = distributeAcrossDays(items, START, 1, PREFS([10]), TZ);
    const todays = buckets[0]!.items;
    expect(todays.filter((i) => i.topic_id === "t-a")).toHaveLength(5);
    expect(todays.filter((i) => i.topic_id === "t-b")).toHaveLength(5);
  });

  it("fills from a single topic when others have no items", () => {
    const items = Array.from({ length: 10 }, () =>
      makeFlashcard({ topic_id: "only-topic" }),
    );
    const buckets = distributeAcrossDays(items, START, 1, PREFS([5]), TZ);
    expect(buckets[0]!.items).toHaveLength(5);
    expect(buckets[0]!.items.every((i) => i.topic_id === "only-topic")).toBe(true);
  });

  it("schedules higher-priority topics fully before lower-priority", () => {
    const items = [
      ...Array.from({ length: 10 }, () => makeFlashcard({ topic_id: "t-high" })),
      ...Array.from({ length: 10 }, () => makeFlashcard({ topic_id: "t-low" })),
    ];
    const buckets = distributeAcrossDays(items, START, 1, {
      dailyQuotas: [10],
      flashcardRatio: 1,
      topicPriorities: new Map([
        ["t-high", 1],
        ["t-low", 5],
      ]),
    }, TZ);
    expect(
      buckets[0]!.items.every((i) => i.topic_id === "t-high"),
    ).toBe(true);
  });

  it("splits evenly across topics within the same priority tier", () => {
    const items = [
      ...Array.from({ length: 10 }, () => makeFlashcard({ topic_id: "t-a" })),
      ...Array.from({ length: 10 }, () => makeFlashcard({ topic_id: "t-b" })),
    ];
    const buckets = distributeAcrossDays(items, START, 1, {
      dailyQuotas: [10],
      flashcardRatio: 1,
      topicPriorities: new Map([
        ["t-a", 2],
        ["t-b", 2],
      ]),
    }, TZ);
    const todays = buckets[0]!.items;
    expect(todays.filter((i) => i.topic_id === "t-a")).toHaveLength(5);
    expect(todays.filter((i) => i.topic_id === "t-b")).toHaveLength(5);
  });

  it("falls back to lower-priority topic once higher tier is exhausted", () => {
    const items = [
      ...Array.from({ length: 3 }, () => makeFlashcard({ topic_id: "t-high" })),
      ...Array.from({ length: 10 }, () => makeFlashcard({ topic_id: "t-low" })),
    ];
    const buckets = distributeAcrossDays(items, START, 1, {
      dailyQuotas: [10],
      flashcardRatio: 1,
      topicPriorities: new Map([
        ["t-high", 1],
        ["t-low", 5],
      ]),
    }, TZ);
    const todays = buckets[0]!.items;
    expect(todays.filter((i) => i.topic_id === "t-high")).toHaveLength(3);
    expect(todays.filter((i) => i.topic_id === "t-low")).toHaveLength(7);
  });
});

describe("distributeAcrossDays — sooner-due first", () => {
  it("picks earliest-due items first within a topic bucket", () => {
    const earliest = makeFlashcard({
      topic_id: "t",
      next_review_at: new Date(START.getTime() - 60_000).toISOString(),
    });
    const middle = makeFlashcard({
      topic_id: "t",
      next_review_at: START.toISOString(),
    });
    const latest = makeFlashcard({
      topic_id: "t",
      next_review_at: new Date(START.getTime() - 10_000).toISOString(),
    });
    const buckets = distributeAcrossDays(
      // Pre-sorted asc by next_review_at, as service contract requires.
      [earliest, latest, middle],
      START,
      1,
      PREFS([2]),
      TZ,
    );
    const ids = buckets[0]!.items.map((i) => i.id);
    expect(ids).toEqual([earliest.id, latest.id]);
  });
});

describe("interleaveByType", () => {
  it("alternates flashcard and short-answer items round-robin", () => {
    const items = [
      makeFlashcard({ id: "f1" }),
      makeFlashcard({ id: "f2" }),
      makeFlashcard({ id: "f3" }),
      makeShort({ id: "s1" }),
      makeShort({ id: "s2" }),
      makeShort({ id: "s3" }),
    ];
    const out = interleaveByType(items);
    expect(out.map((i) => i.id)).toEqual(["f1", "s1", "f2", "s2", "f3", "s3"]);
  });

  it("preserves within-type order (sooner-due first)", () => {
    const items = [
      makeFlashcard({ id: "f-early" }),
      makeFlashcard({ id: "f-late" }),
      makeShort({ id: "s-early" }),
      makeShort({ id: "s-late" }),
    ];
    const out = interleaveByType(items);
    expect(out.map((i) => i.id)).toEqual([
      "f-early",
      "s-early",
      "f-late",
      "s-late",
    ]);
  });

  it("appends remaining items when one type runs out", () => {
    const items = [
      makeFlashcard({ id: "f1" }),
      makeFlashcard({ id: "f2" }),
      makeFlashcard({ id: "f3" }),
      makeShort({ id: "s1" }),
    ];
    const out = interleaveByType(items);
    expect(out.map((i) => i.id)).toEqual(["f1", "s1", "f2", "f3"]);
  });

  it("returns single-type input unchanged", () => {
    const items = [
      makeFlashcard({ id: "f1" }),
      makeFlashcard({ id: "f2" }),
    ];
    expect(interleaveByType(items).map((i) => i.id)).toEqual(["f1", "f2"]);
  });
});

describe("orderForBonus", () => {
  it("emits all priority-1 items before any priority-2 item", () => {
    const items = [
      ...Array.from({ length: 4 }, () => makeFlashcard({ topic_id: "t-low" })),
      ...Array.from({ length: 4 }, () => makeFlashcard({ topic_id: "t-high" })),
    ];
    const ordered = orderForBonus(
      items,
      new Map([
        ["t-high", 1],
        ["t-low", 5],
      ]),
    );
    const firstFour = ordered.slice(0, 4).map((i) => i.topic_id);
    const lastFour = ordered.slice(4).map((i) => i.topic_id);
    expect(firstFour.every((t) => t === "t-high")).toBe(true);
    expect(lastFour.every((t) => t === "t-low")).toBe(true);
  });

  it("interleaves topics within the same priority tier", () => {
    const items = [
      makeFlashcard({ id: "a1", topic_id: "t-a" }),
      makeFlashcard({ id: "a2", topic_id: "t-a" }),
      makeFlashcard({ id: "a3", topic_id: "t-a" }),
      makeFlashcard({ id: "b1", topic_id: "t-b" }),
      makeFlashcard({ id: "b2", topic_id: "t-b" }),
      makeFlashcard({ id: "b3", topic_id: "t-b" }),
    ];
    const ordered = orderForBonus(items, new Map([["t-a", 1], ["t-b", 1]]));
    expect(ordered.map((i) => i.id)).toEqual(["a1", "b1", "a2", "b2", "a3", "b3"]);
  });

  it("alternates types within a priority tier", () => {
    const items = [
      makeFlashcard({ id: "f1", topic_id: "t" }),
      makeFlashcard({ id: "f2", topic_id: "t" }),
      makeShort({ id: "s1", topic_id: "t" }),
      makeShort({ id: "s2", topic_id: "t" }),
    ];
    const ordered = orderForBonus(items, new Map([["t", 1]]));
    // round-robin within type produces [f1, f2] and [s1, s2]; alternation
    // gives [f1, s1, f2, s2].
    expect(ordered.map((i) => i.id)).toEqual(["f1", "s1", "f2", "s2"]);
  });

  it("treats all topics as default priority when no map is given", () => {
    const items = [
      makeFlashcard({ id: "a1", topic_id: "t-a" }),
      makeFlashcard({ id: "b1", topic_id: "t-b" }),
    ];
    expect(orderForBonus(items, undefined).map((i) => i.id)).toEqual([
      "a1",
      "b1",
    ]);
  });
});

describe("formatDateKey", () => {
  it("formats UTC date as YYYY-MM-DD", () => {
    expect(formatDateKey(new Date("2026-05-09T15:30:00.000Z"), "UTC")).toBe(
      "2026-05-09",
    );
  });
});

describe("distributeAcrossDays — skip days", () => {
  it("returns an empty bucket for a skipped day and rolls items forward", () => {
    // 4 items all due day 0. Quota is 2/day. Day 1 is skipped → items that
    // would have landed there on a normal schedule appear on day 2 instead.
    const items = Array.from({ length: 4 }, () => makeFlashcard());
    const buckets = distributeAcrossDays(
      items,
      START,
      3,
      { ...PREFS([2, 2, 2]), skipDates: new Set(["2026-05-10"]) },
      TZ,
    );
    expect(buckets.map((b) => b.items.length)).toEqual([2, 0, 2]);
    expect(buckets[1]!.date).toBe("2026-05-10");
  });

  it("does not consume the daily quota on a skipped day", () => {
    // 5 items all due day 0. Quota 2/day. With day 1 skipped, the first 2
    // land on day 0 and remaining 3 try to fit days 1+2. Day 1 is skipped
    // (no quota consumed), so day 2 still gets only 2 items, leaving 1
    // unscheduled in this 3-day window.
    const items = Array.from({ length: 5 }, () => makeFlashcard());
    const buckets = distributeAcrossDays(
      items,
      START,
      3,
      { ...PREFS([2, 2, 2]), skipDates: new Set(["2026-05-10"]) },
      TZ,
    );
    expect(buckets.map((b) => b.items.length)).toEqual([2, 0, 2]);
    const placed = buckets.flatMap((b) => b.items).length;
    expect(placed).toBe(4);
  });

  it("places an item due only on a skipped day on the next non-skipped day", () => {
    // Item is only eligible starting 2026-05-10 (the skipped day). With day
    // 1 skipped it should appear on day 2.
    const item = makeFlashcard({
      next_review_at: "2026-05-10T08:00:00.000Z",
    });
    const buckets = distributeAcrossDays(
      [item],
      START,
      3,
      { ...PREFS([5, 5, 5]), skipDates: new Set(["2026-05-10"]) },
      TZ,
    );
    expect(buckets[0]!.items).toHaveLength(0);
    expect(buckets[1]!.items).toHaveLength(0);
    expect(buckets[2]!.items.map((i) => i.id)).toEqual([item.id]);
  });

  it("handles back-to-back skip days", () => {
    const items = Array.from({ length: 3 }, () => makeFlashcard());
    const buckets = distributeAcrossDays(
      items,
      START,
      4,
      {
        ...PREFS([1, 1, 1, 1]),
        skipDates: new Set(["2026-05-10", "2026-05-11"]),
      },
      TZ,
    );
    expect(buckets.map((b) => b.items.length)).toEqual([1, 0, 0, 1]);
  });

  it("treats an empty skipDates set as a no-op", () => {
    const items = Array.from({ length: 4 }, () => makeFlashcard());
    const buckets = distributeAcrossDays(
      items,
      START,
      2,
      { ...PREFS([2, 2]), skipDates: new Set() },
      TZ,
    );
    expect(buckets.map((b) => b.items.length)).toEqual([2, 2]);
  });
});
