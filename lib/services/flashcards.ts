// Flashcards service. PURE: takes a SupabaseClient, no Next/React imports.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Flashcard,
  FlashcardInsert,
  FlashcardUpdate,
} from "../types/domain";

// --- Validation schemas --------------------------------------------------

export const FlashcardCreateSchema = z.object({
  front: z.string().trim().min(1, "Front is required").max(2000),
  back: z.string().trim().min(1, "Back is required").max(2000),
});

export type FlashcardCreateInput = z.infer<typeof FlashcardCreateSchema>;

export const FlashcardUpdateSchema = FlashcardCreateSchema.partial();
export type FlashcardUpdateInput = z.infer<typeof FlashcardUpdateSchema>;

// --- Service functions ---------------------------------------------------

type Client = SupabaseClient<Database>;

export async function listFlashcardsForTopic(
  client: Client,
  topicId: string,
): Promise<Flashcard[]> {
  const { data, error } = await client
    .from("flashcards")
    .select("*")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createFlashcard(
  client: Client,
  userId: string,
  topicId: string,
  input: FlashcardCreateInput,
): Promise<Flashcard> {
  const insert: FlashcardInsert = {
    user_id: userId,
    topic_id: topicId,
    front: input.front,
    back: input.back,
  };
  const { data, error } = await client
    .from("flashcards")
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFlashcard(
  client: Client,
  id: string,
  input: FlashcardUpdateInput,
): Promise<Flashcard> {
  const update: FlashcardUpdate = {};
  if (input.front !== undefined) update.front = input.front;
  if (input.back !== undefined) update.back = input.back;

  const { data, error } = await client
    .from("flashcards")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFlashcard(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client.from("flashcards").delete().eq("id", id);
  if (error) throw error;
}
