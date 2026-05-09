// Reviews service. PURE: takes a SupabaseClient, no Next/React imports.
//
// getDueQueue: union of due flashcards + short-answer items, sorted oldest-due
// first, returned as a discriminated union.
// getDueCount: just the count, for the dashboard.
// recordReview: thin wrapper over the record_review Postgres function (see
// supabase/migrations/0004_record_review_function.sql) which does the
// transactional update + history insert.

import type { SupabaseClient } from "@supabase/supabase-js";
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
