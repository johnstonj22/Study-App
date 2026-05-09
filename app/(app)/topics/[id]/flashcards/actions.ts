"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  FlashcardCreateSchema,
  createFlashcard,
  deleteFlashcard,
} from "@/lib/services/flashcards";
import { getTopic } from "@/lib/services/topics";

export type FormState = { error: string | null };

export async function createFlashcardAction(
  topicId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = FlashcardCreateSchema.safeParse({
    front: formData.get("front") ?? "",
    back: formData.get("back") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // RLS-scoped lookup: returns null if the topic isn't owned by this user.
  // Defense against submitting a topic_id that doesn't belong to the caller.
  const topic = await getTopic(supabase, topicId);
  if (!topic) return { error: "Topic not found" };

  try {
    await createFlashcard(supabase, user.id, topicId, parsed.data);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create flashcard",
    };
  }

  revalidatePath(`/topics/${topicId}`);
  revalidatePath("/dashboard");
  redirect(`/topics/${topicId}`);
}

export async function deleteFlashcardAction(
  flashcardId: string,
  topicId: string,
): Promise<void> {
  const supabase = await createClient();
  await deleteFlashcard(supabase, flashcardId);
  revalidatePath(`/topics/${topicId}`);
  revalidatePath("/dashboard");
}
