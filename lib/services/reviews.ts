// Reviews service. PURE: takes a SupabaseClient, no Next/React imports.
//
// getDueQueue: union of due flashcards + short-answer items, sorted oldest-due
// first, returned as a discriminated union.
// getDueCount: just the count, for the dashboard.
// getItemsInWindow: items whose next_review_at falls anywhere in [from, to);
// used to project the calendar across multiple days.
// getCompletedCountsByDay: aggregates review_history into per-day counts in
// the caller's timezone — drives "completed today" + past-day calendar cells.
// recordReview: thin wrapper over the record_review Postgres function (see
// supabase/migrations/0004_record_review_function.sql) which does the
// transactional update + history insert.

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDateKey } from "../scheduler";
import type {
  Database,
  Rating,
  ReviewItemType,
  ReviewQueueItem,
} from "../types/domain";

type Client = SupabaseClient<Database>;

export async function getDueQueue(
  client: Client,
  now: Date,
): Promise<ReviewQueueItem[]> {
  const nowIso = now.toISOString();
  const [flashcardsRes, questionsRes] = await Promise.all([
    client
      .from("flashcards")
      .select("*")
      .lte("next_review_at", nowIso)
      .order("next_review_at", { ascending: true }),
    client
      .from("short_answer_questions")
      .select("*")
      .lte("next_review_at", nowIso)
      .order("next_review_at", { ascending: true }),
  ]);

  if (flashcardsRes.error) throw flashcardsRes.error;
  if (questionsRes.error) throw questionsRes.error;

  const items: ReviewQueueItem[] = [
    ...(flashcardsRes.data ?? []).map((fc) => ({
      kind: "flashcard" as const,
      ...fc,
    })),
    ...(questionsRes.data ?? []).map((q) => ({
      kind: "short_answer" as const,
      ...q,
    })),
  ];

  items.sort(
    (a, b) =>
      new Date(a.next_review_at).getTime() -
      new Date(b.next_review_at).getTime(),
  );

  return items;
}

export async function getDueCount(client: Client, now: Date): Promise<number> {
  const nowIso = now.toISOString();
  const [flashcardsRes, questionsRes] = await Promise.all([
    client
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .lte("next_review_at", nowIso),
    client
      .from("short_answer_questions")
      .select("id", { count: "exact", head: true })
      .lte("next_review_at", nowIso),
  ]);
  if (flashcardsRes.error) throw flashcardsRes.error;
  if (questionsRes.error) throw questionsRes.error;
  return (flashcardsRes.count ?? 0) + (questionsRes.count ?? 0);
}

// Items whose next_review_at sits in [from, to). Used by the calendar to fetch
// every item that could land in any day of the visible window.
export async function getItemsInWindow(
  client: Client,
  from: Date,
  to: Date,
): Promise<ReviewQueueItem[]> {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const [flashcardsRes, questionsRes] = await Promise.all([
    client
      .from("flashcards")
      .select("*")
      .gte("next_review_at", fromIso)
      .lt("next_review_at", toIso)
      .order("next_review_at", { ascending: true }),
    client
      .from("short_answer_questions")
      .select("*")
      .gte("next_review_at", fromIso)
      .lt("next_review_at", toIso)
      .order("next_review_at", { ascending: true }),
  ]);
  if (flashcardsRes.error) throw flashcardsRes.error;
  if (questionsRes.error) throw questionsRes.error;

  const items: ReviewQueueItem[] = [
    ...(flashcardsRes.data ?? []).map((fc) => ({
      kind: "flashcard" as const,
      ...fc,
    })),
    ...(questionsRes.data ?? []).map((q) => ({
      kind: "short_answer" as const,
      ...q,
    })),
  ];
  items.sort(
    (a, b) =>
      new Date(a.next_review_at).getTime() -
      new Date(b.next_review_at).getTime(),
  );
  return items;
}

// Counts of completed reviews per day (in the given timezone) within
// [from, to). Used to render "completed today" + past-day calendar cells.
export async function getCompletedCountsByDay(
  client: Client,
  from: Date,
  to: Date,
  timezone: string,
): Promise<Map<string, number>> {
  const { data, error } = await client
    .from("review_history")
    .select("reviewed_at")
    .gte("reviewed_at", from.toISOString())
    .lt("reviewed_at", to.toISOString());
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = formatDateKey(new Date(row.reviewed_at), timezone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export async function recordReview(
  client: Client,
  params: {
    itemType: ReviewItemType;
    itemId: string;
    rating: Rating;
    newMasteryScore: number;
    nextReviewAt: Date;
    now: Date;
  },
): Promise<void> {
  const { error } = await client.rpc("record_review", {
    p_item_type: params.itemType,
    p_item_id: params.itemId,
    p_rating: params.rating,
    p_new_mastery_score: params.newMasteryScore,
    p_next_review_at: params.nextReviewAt.toISOString(),
    p_now: params.now.toISOString(),
  });
  if (error) throw error;
}
