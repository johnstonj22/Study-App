// Domain types layer.
//
// Re-exports the generated Database type and provides convenient row/insert/
// update aliases for each table, plus a Rating literal and a discriminated
// union for the review queue.
//
// PURE module: must not import from `next/*`, `react`, or `@supabase/ssr`,
// so it can be reused by a future Expo client.

import type { Database } from "./database";

export type { Database };

// --- Table row aliases ---------------------------------------------------

type Tables = Database["public"]["Tables"];

export type Profile = Tables["profiles"]["Row"];
export type ProfileInsert = Tables["profiles"]["Insert"];
export type ProfileUpdate = Tables["profiles"]["Update"];

// `parent_id` is added by migration 0008. The local intersection keeps the
// service layer compiling against the current generated Database type until
// `npx supabase gen types typescript --linked > lib/types/database.ts` is
// re-run after the migration is applied. The intersection is harmless once
// the column is properly typed in Database — TS just sees `string | null`
// either way.
export type Topic = Tables["topics"]["Row"] & { parent_id: string | null };
export type TopicInsert = Tables["topics"]["Insert"] & {
  parent_id?: string | null;
};
export type TopicUpdate = Tables["topics"]["Update"] & {
  parent_id?: string | null;
};

// A topic with its descendants resolved into a nested structure. Built
// in-memory by `getTopicTree` from a flat list. Pure value type.
export type TopicTreeNode = Topic & { children: TopicTreeNode[] };

export type Flashcard = Tables["flashcards"]["Row"];
export type FlashcardInsert = Tables["flashcards"]["Insert"];
export type FlashcardUpdate = Tables["flashcards"]["Update"];

export type ShortAnswerQuestion = Tables["short_answer_questions"]["Row"];
export type ShortAnswerQuestionInsert = Tables["short_answer_questions"]["Insert"];
export type ShortAnswerQuestionUpdate = Tables["short_answer_questions"]["Update"];

export type ReviewHistory = Tables["review_history"]["Row"];
export type ReviewHistoryInsert = Tables["review_history"]["Insert"];

// --- Review domain -------------------------------------------------------

export type Rating = "again" | "hard" | "good" | "easy";

export type ReviewItemType = "flashcard" | "short_answer";

// Discriminated union returned by the review-queue service. Lets components
// switch on `kind` to render either flashcard front/back or short-answer
// prompt/expected_answer.
export type ReviewQueueItem =
  | ({ kind: "flashcard" } & Flashcard)
  | ({ kind: "short_answer" } & ShortAnswerQuestion);

// --- Distribution / scheduling --------------------------------------------

export interface DistributionPrefs {
  // Per-day quota, length must equal the requested numDays. Caller can pass
  // [dailyQuota - completedToday, dailyQuota, dailyQuota, ...] to reflect
  // already-completed work today, or [dailyQuota] * numDays for a fresh
  // projection.
  dailyQuotas: number[];
  // 0..1 share of each day allocated to flashcards (rest goes to short-answer).
  // Defaults to 0.5 when omitted by the caller.
  flashcardRatio: number;
  // Optional per-topic priority. Lower number = higher priority. The
  // algorithm allocates priority-1 items in full before priority-2, etc.
  // Within a tier topics share evenly. Missing topics use defaultPriority.
  topicPriorities?: Map<string, number>;
  // Priority assumed for topics not present in topicPriorities. Defaults
  // to 5 (the schema's column default), so unconfigured users behave
  // identically to "all topics tied at the same priority".
  defaultPriority?: number;
  // Set of YYYY-MM-DD strings (in the same timezone the distribution is
  // computed in) the user wants to skip. On those days the bucket is empty
  // and `dailyQuotas[i]` is NOT consumed; eligible items roll forward to
  // the next non-skipped day naturally.
  skipDates?: Set<string>;
}

export interface DayBucket {
  // YYYY-MM-DD in the caller-supplied timezone.
  date: string;
  items: ReviewQueueItem[];
}
