// Short-answer questions service. PURE: takes a SupabaseClient, no Next/React.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ShortAnswerQuestion,
  ShortAnswerQuestionInsert,
  ShortAnswerQuestionUpdate,
} from "../types/domain";

// --- Validation schemas --------------------------------------------------

export const ShortAnswerCreateSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required").max(2000),
  expected_answer: z.string().trim().max(4000).optional().nullable(),
});

export type ShortAnswerCreateInput = z.infer<typeof ShortAnswerCreateSchema>;

export const ShortAnswerUpdateSchema = ShortAnswerCreateSchema.partial();
export type ShortAnswerUpdateInput = z.infer<typeof ShortAnswerUpdateSchema>;

// --- Service functions ---------------------------------------------------

type Client = SupabaseClient<Database>;

export async function listShortAnswersForTopic(
  client: Client,
  topicId: string,
): Promise<ShortAnswerQuestion[]> {
  const { data, error } = await client
    .from("short_answer_questions")
    .select("*")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createShortAnswer(
  client: Client,
  userId: string,
  topicId: string,
  input: ShortAnswerCreateInput,
): Promise<ShortAnswerQuestion> {
  const insert: ShortAnswerQuestionInsert = {
    user_id: userId,
    topic_id: topicId,
    prompt: input.prompt,
    expected_answer: input.expected_answer ?? null,
  };
  const { data, error } = await client
    .from("short_answer_questions")
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShortAnswer(
  client: Client,
  id: string,
  input: ShortAnswerUpdateInput,
): Promise<ShortAnswerQuestion> {
  const update: ShortAnswerQuestionUpdate = {};
  if (input.prompt !== undefined) update.prompt = input.prompt;
  if (input.expected_answer !== undefined) {
    update.expected_answer = input.expected_answer;
  }

  const { data, error } = await client
    .from("short_answer_questions")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShortAnswer(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("short_answer_questions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
