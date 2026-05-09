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

export type Topic = Tables["topics"]["Row"];
export type TopicInsert = Tables["topics"]["Insert"];
export type TopicUpdate = Tables["topics"]["Update"];

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
