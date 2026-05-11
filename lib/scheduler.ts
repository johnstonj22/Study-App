// Placeholder scheduler. Pure logic, no I/O, no framework imports.
//
// Fixed intervals per rating; no ease factor, no repetition tracking.
// Intended to be replaced with a richer SM-2 / FSRS-style scheduler later.
// The flashcards / short_answer_questions tables already carry
// ease_factor / interval_days / repetitions columns for that future work.
//
// Also exports `distributeAcrossDays`: a pure greedy water-fill that maps
// review-queue items onto consecutive days given per-day quotas, type ratio,
// and optional per-topic weights. Used by the review page (today's bucket)
// and the calendar page (full-window projection).

import type {
  DayBucket,
  DistributionPrefs,
  Rating,
  ReviewQueueItem,
} from "./types/domain";

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

// ---------------------------------------------------------------------------
// distributeAcrossDays
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Format a Date as YYYY-MM-DD using the given IANA timezone. Falls back to
// UTC components if Intl is unavailable.
export function formatDateKey(date: Date, timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // en-CA gives YYYY-MM-DD already.
    return fmt.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

// Add `days` days to a date in UTC milliseconds. Used for cheap iteration
// where DST drift doesn't matter (e.g., labelling cells when the caller
// already computes per-day instants via startOfLocalDay).
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

// Day of week (0=Sun .. 6=Sat) for a YYYY-MM-DD calendar date. Computed
// via UTC arithmetic on the bare Y-M-D — independent of the user's
// timezone since "what weekday is May 10, 2026" has the same answer
// everywhere.
export function dowFromDateKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

// UTC instant when local clock in `timezone` reads `year-month-day 00:00:00`.
// Handles DST correctly. Negative/overflow day values are normalised by
// JS Date (e.g., day=0 → last day of previous month), which we use to walk
// calendars by Y-M-D arithmetic without manually handling month/year rollover.
export function startOfLocalDay(
  year: number,
  month: number, // 1-12
  day: number,
  timezone: string,
): Date {
  // Normalise the calendar date first so callers can pass day=-3 etc.
  const calendar = new Date(Date.UTC(year, month - 1, day));
  const cy = calendar.getUTCFullYear();
  const cm = calendar.getUTCMonth();
  const cd = calendar.getUTCDate();

  // Probe: a UTC instant that names this Y-M-D 00:00:00 in UTC.
  const probe = Date.UTC(cy, cm, cd);
  const probeDate = new Date(probe);

  // What does that probe display as in the target timezone?
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(probeDate);
  const part = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  // en-CA hour can come back as "24" for midnight; normalise.
  const localH = part("hour") % 24;
  const shifted = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    localH,
    part("minute"),
    part("second"),
  );

  // The local clock at `probe` is `shifted - probe` ms ahead of UTC. To get
  // an instant whose local clock reads Y-M-D 00:00:00, subtract that offset.
  return new Date(probe - (shifted - probe));
}

// UTC instant of the most recent local-midnight at-or-before `date` in tz.
export function startOfDayInTimezone(date: Date, timezone: string): Date {
  const key = formatDateKey(date, timezone); // YYYY-MM-DD in tz
  const [y, m, d] = key.split("-").map(Number);
  return startOfLocalDay(y!, m!, d!, timezone);
}

// Round-robin interleave a session's items across flashcard / short-answer
// types so the user doesn't have to plow through every flashcard before
// seeing a single short-answer. Preserves within-type order (typically
// next_review_at asc → sooner-due first within each type).
export function interleaveByType(
  items: ReviewQueueItem[],
): ReviewQueueItem[] {
  const flash: ReviewQueueItem[] = [];
  const short: ReviewQueueItem[] = [];
  for (const item of items) {
    if (item.kind === "flashcard") flash.push(item);
    else short.push(item);
  }
  const result: ReviewQueueItem[] = [];
  let fi = 0;
  let si = 0;
  while (fi < flash.length || si < short.length) {
    if (fi < flash.length) result.push(flash[fi++]!);
    if (si < short.length) result.push(short[si++]!);
  }
  return result;
}

// Matches the column default in migration 0007. Only used when a caller
// passes an item whose topic isn't represented in the priorities map (rare
// — the pages always fetch the full set).
const DEFAULT_PRIORITY = 1;

// Group items by topic_id (preserving input order within each group), then
// emit them round-robin across topics. Used to interleave a session so the
// user doesn't see all of one topic in a row.
function roundRobinByTopic(items: ReviewQueueItem[]): ReviewQueueItem[] {
  const byTopic = new Map<string, ReviewQueueItem[]>();
  const order: string[] = [];
  for (const item of items) {
    let list = byTopic.get(item.topic_id);
    if (!list) {
      list = [];
      byTopic.set(item.topic_id, list);
      order.push(item.topic_id);
    }
    list.push(item);
  }
  const result: ReviewQueueItem[] = [];
  let i = 0;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const topicId of order) {
      const list = byTopic.get(topicId)!;
      if (i < list.length) {
        result.push(list[i]!);
        progressed = true;
      }
    }
    i++;
  }
  return result;
}

// Even-split `take` items across topics in a tier, then emit round-robin.
// `tierItems` are all items belonging to a single priority tier.
function evenSplitTier(
  tierItems: ReviewQueueItem[],
  take: number,
): ReviewQueueItem[] {
  if (take <= 0) return [];
  if (tierItems.length <= take) return roundRobinByTopic(tierItems);

  const byTopic = new Map<string, ReviewQueueItem[]>();
  const order: string[] = [];
  for (const item of tierItems) {
    let list = byTopic.get(item.topic_id);
    if (!list) {
      list = [];
      byTopic.set(item.topic_id, list);
      order.push(item.topic_id);
    }
    list.push(item);
  }

  type Alloc = {
    id: string;
    available: ReviewQueueItem[];
    share: number;
    earliest: number;
  };
  const allocs: Alloc[] = order.map((id) => ({
    id,
    available: byTopic.get(id)!,
    share: 0,
    earliest: new Date(byTopic.get(id)![0]!.next_review_at).getTime(),
  }));

  // Base share = floor(take / topics). Distribute remainder to topics with
  // capacity, preferring earliest-due first as tie-break.
  const numTopics = allocs.length;
  const baseShare = Math.floor(take / numTopics);
  let remainder = take % numTopics;
  for (const a of allocs) a.share = Math.min(baseShare, a.available.length);

  while (remainder > 0) {
    const candidates = allocs
      .filter((a) => a.share < a.available.length)
      .sort((a, b) => a.earliest - b.earliest);
    if (candidates.length === 0) break;
    candidates[0]!.share += 1;
    remainder -= 1;
  }

  // Pick earliest-due items per topic per share.
  const picks = new Map<string, ReviewQueueItem[]>();
  let allocated = 0;
  for (const a of allocs) {
    picks.set(a.id, a.available.slice(0, a.share));
    allocated += a.share;
  }

  // Spillover: if some topics ran short of their share, top up from the
  // tier's remaining global pool by earliest due date.
  if (allocated < take) {
    const pickedSet = new Set<ReviewQueueItem>();
    for (const list of picks.values()) {
      for (const item of list) pickedSet.add(item);
    }
    const leftovers = tierItems
      .filter((it) => !pickedSet.has(it))
      .sort(
        (a, b) =>
          new Date(a.next_review_at).getTime() -
          new Date(b.next_review_at).getTime(),
      );
    for (const item of leftovers) {
      if (allocated >= take) break;
      picks.get(item.topic_id)!.push(item);
      allocated += 1;
    }
  }

  // Round-robin emit across topics in the tier.
  const result: ReviewQueueItem[] = [];
  let i = 0;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const topicId of order) {
      const list = picks.get(topicId)!;
      if (i < list.length) {
        result.push(list[i]!);
        progressed = true;
      }
    }
    i++;
  }
  return result;
}

// Pick `take` items from a single-type pool, respecting priority tiers and
// even-splitting across topics within a tier. Lower priority value first.
function splitByTopic(
  items: ReviewQueueItem[],
  take: number,
  priorities: Map<string, number> | undefined,
  defaultPriority: number,
): ReviewQueueItem[] {
  if (take <= 0 || items.length === 0) return [];
  if (items.length <= take) {
    // Still emit by priority for ordering (priority-1 first), interleaved
    // round-robin within each tier.
    return orderByPriorityAndTopic(items, priorities, defaultPriority);
  }

  // Bucket items by priority tier.
  const tiers = new Map<number, ReviewQueueItem[]>();
  for (const item of items) {
    const p = priorities?.get(item.topic_id) ?? defaultPriority;
    let list = tiers.get(p);
    if (!list) {
      list = [];
      tiers.set(p, list);
    }
    list.push(item);
  }

  const sortedPriorities = [...tiers.keys()].sort((a, b) => a - b);
  const result: ReviewQueueItem[] = [];
  let remaining = take;

  for (const priority of sortedPriorities) {
    if (remaining <= 0) break;
    const tierItems = tiers.get(priority)!;
    if (tierItems.length <= remaining) {
      result.push(...roundRobinByTopic(tierItems));
      remaining -= tierItems.length;
    } else {
      result.push(...evenSplitTier(tierItems, remaining));
      remaining = 0;
    }
  }
  return result;
}

// Order an entire item list by priority (asc), interleaving topics within
// each tier round-robin. Used for the bonus session ordering and for the
// "everything fits" branch of splitByTopic.
function orderByPriorityAndTopic(
  items: ReviewQueueItem[],
  priorities: Map<string, number> | undefined,
  defaultPriority: number,
): ReviewQueueItem[] {
  const tiers = new Map<number, ReviewQueueItem[]>();
  for (const item of items) {
    const p = priorities?.get(item.topic_id) ?? defaultPriority;
    let list = tiers.get(p);
    if (!list) {
      list = [];
      tiers.set(p, list);
    }
    list.push(item);
  }
  const result: ReviewQueueItem[] = [];
  for (const priority of [...tiers.keys()].sort((a, b) => a - b)) {
    result.push(...roundRobinByTopic(tiers.get(priority)!));
  }
  return result;
}

// Public helper: order any item list for a review session, balanced by
// priority (lower first), then by topic round-robin within each tier, then
// by type alternation. Used for the bonus queue.
export function orderForBonus(
  items: ReviewQueueItem[],
  priorities: Map<string, number> | undefined,
  defaultPriority: number = DEFAULT_PRIORITY,
): ReviewQueueItem[] {
  // Bucket by priority tier first so priority-1 items come out before any
  // priority-2 item.
  const tiers = new Map<number, ReviewQueueItem[]>();
  for (const item of items) {
    const p = priorities?.get(item.topic_id) ?? defaultPriority;
    let list = tiers.get(p);
    if (!list) {
      list = [];
      tiers.set(p, list);
    }
    list.push(item);
  }
  const result: ReviewQueueItem[] = [];
  for (const priority of [...tiers.keys()].sort((a, b) => a - b)) {
    const tierItems = tiers.get(priority)!;
    // Within a tier: round-robin topics inside each type, then alternate
    // types — same shape as a daily allocation.
    const flash = tierItems.filter((i) => i.kind === "flashcard");
    const short = tierItems.filter((i) => i.kind === "short_answer");
    const flashOrdered = roundRobinByTopic(flash);
    const shortOrdered = roundRobinByTopic(short);
    let fi = 0;
    let si = 0;
    while (fi < flashOrdered.length || si < shortOrdered.length) {
      if (fi < flashOrdered.length) result.push(flashOrdered[fi++]!);
      if (si < shortOrdered.length) result.push(shortOrdered[si++]!);
    }
  }
  return result;
}

// Allocate `target` items for a single day from the eligible pool, balancing
// by type (flashcard vs short_answer) then by topic.
function allocateForDay(
  pool: ReviewQueueItem[],
  target: number,
  prefs: DistributionPrefs,
): ReviewQueueItem[] {
  if (target <= 0 || pool.length === 0) return [];
  if (pool.length <= target) return [...pool];

  const flash = pool.filter((i) => i.kind === "flashcard");
  const short = pool.filter((i) => i.kind === "short_answer");

  let flashTake = Math.min(
    Math.round(target * prefs.flashcardRatio),
    flash.length,
  );
  let shortTake = Math.min(target - flashTake, short.length);

  // Redistribute leftover when one type ran short.
  let leftover = target - flashTake - shortTake;
  if (leftover > 0 && flash.length > flashTake) {
    const extra = Math.min(leftover, flash.length - flashTake);
    flashTake += extra;
    leftover -= extra;
  }
  if (leftover > 0 && short.length > shortTake) {
    shortTake += Math.min(leftover, short.length - shortTake);
  }

  const defaultPriority = prefs.defaultPriority ?? DEFAULT_PRIORITY;
  return interleaveByType([
    ...splitByTopic(flash, flashTake, prefs.topicPriorities, defaultPriority),
    ...splitByTopic(short, shortTake, prefs.topicPriorities, defaultPriority),
  ]);
}

// Greedy water-fill across days. `items` should be pre-sorted asc by
// next_review_at (matches what getDueQueue / getItemsInWindow return).
//
// Items with `next_review_at` after the visible window simply don't appear
// in any returned bucket — the caller is responsible for choosing a window
// large enough to cover what they want to display.
export function distributeAcrossDays(
  items: ReviewQueueItem[],
  startDate: Date,
  numDays: number,
  prefs: DistributionPrefs,
  timezone: string,
): DayBucket[] {
  if (prefs.dailyQuotas.length !== numDays) {
    throw new Error(
      `dailyQuotas length ${prefs.dailyQuotas.length} must match numDays ${numDays}`,
    );
  }

  const remaining = [...items];
  const buckets: DayBucket[] = [];

  // Anchor day-walking on the local Y-M-D of startDate, then increment by
  // calendar days. This keeps boundaries correct across DST transitions
  // (a "spring forward" day is 23h, "fall back" is 25h — using fixed 24h
  // increments would drift the local boundary by an hour on those days).
  const startKey = formatDateKey(startDate, timezone);
  const [sy, sm, sd] = startKey.split("-").map(Number);

  for (let i = 0; i < numDays; i++) {
    const dayStart = startOfLocalDay(sy!, sm!, sd! + i, timezone);
    const dayKey = formatDateKey(dayStart, timezone);

    // Skip days: empty bucket, no items consumed from `remaining`. The day's
    // quota is intentionally not consumed either — items eligible only on a
    // skipped day roll forward to the next non-skipped day's eligible pool
    // naturally.
    if (prefs.skipDates?.has(dayKey)) {
      buckets.push({ date: dayKey, items: [] });
      continue;
    }

    const nextDayStart = startOfLocalDay(sy!, sm!, sd! + i + 1, timezone);
    const dayEndMs = nextDayStart.getTime();

    const eligible = remaining.filter(
      (it) => new Date(it.next_review_at).getTime() < dayEndMs,
    );

    const quota = Math.max(0, prefs.dailyQuotas[i] ?? 0);
    const target = Math.min(eligible.length, quota);
    const allocated = allocateForDay(eligible, target, prefs);

    if (allocated.length > 0) {
      const allocatedSet = new Set(allocated);
      for (let j = remaining.length - 1; j >= 0; j--) {
        if (allocatedSet.has(remaining[j]!)) remaining.splice(j, 1);
      }
    }

    buckets.push({ date: dayKey, items: allocated });
  }

  return buckets;
}
