"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ShortAnswerCreateSchema,
  createShortAnswer,
  deleteShortAnswer,
} from "@/lib/services/shortAnswerQuestions";
import { getTopic } from "@/lib/services/topics";

export type FormState = { error: string | null };

export async function createShortAnswerAction(
  topicId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = ShortAnswerCreateSchema.safeParse({
    prompt: formData.get("prompt") ?? "",
    expected_answer: (formData.get("expected_answer") || null) as
      | string
      | null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const topic = await getTopic(supabase, topicId);
  if (!topic) return { error: "Topic not found" };

  try {
    await createShortAnswer(supabase, user.id, topicId, parsed.data);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create question",
    };
  }

  revalidatePath(`/topics/${topicId}`);
  revalidatePath("/dashboard");
  redirect(`/topics/${topicId}`);
}

export async function deleteShortAnswerAction(
  questionId: string,
  topicId: string,
): Promise<void> {
  const supabase = await createClient();
  await deleteShortAnswer(supabase, questionId);
  revalidatePath(`/topics/${topicId}`);
  revalidatePath("/dashboard");
}
