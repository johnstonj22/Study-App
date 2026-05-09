// Topics service. PURE: takes a SupabaseClient, no Next/React imports.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Topic,
  TopicInsert,
  TopicUpdate,
} from "../types/domain";

// --- Validation schemas --------------------------------------------------

export const TopicCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
});

export type TopicCreateInput = z.infer<typeof TopicCreateSchema>;

export const TopicUpdateSchema = TopicCreateSchema.partial();
export type TopicUpdateInput = z.infer<typeof TopicUpdateSchema>;

// --- Service functions ---------------------------------------------------

type Client = SupabaseClient<Database>;

export async function listTopics(client: Client): Promise<Topic[]> {
  const { data, error } = await client
    .from("topics")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTopic(
  client: Client,
  id: string,
): Promise<Topic | null> {
  const { data, error } = await client
    .from("topics")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTopic(
  client: Client,
  userId: string,
  input: TopicCreateInput,
): Promise<Topic> {
  const insert: TopicInsert = {
    user_id: userId,
    title: input.title,
    description: input.description ?? null,
    category: input.category ?? null,
  };
  const { data, error } = await client
    .from("topics")
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTopic(
  client: Client,
  id: string,
  input: TopicUpdateInput,
): Promise<Topic> {
  const update: TopicUpdate = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description;
  if (input.category !== undefined) update.category = input.category;

  const { data, error } = await client
    .from("topics")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTopic(client: Client, id: string): Promise<void> {
  const { error } = await client.from("topics").delete().eq("id", id);
  if (error) throw error;
}

export async function getRecentTopics(
  client: Client,
  limit: number,
): Promise<Topic[]> {
  const { data, error } = await client
    .from("topics")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getWeakestTopics(
  client: Client,
  limit: number,
): Promise<Topic[]> {
  const { data, error } = await client
    .from("topics")
    .select("*")
    .order("mastery_score", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
