"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  TopicCreateSchema,
  createTopic,
  deleteTopic,
} from "@/lib/services/topics";
import type { Topic } from "@/lib/types/domain";

export type FormState = { error: string | null };

export async function createTopicAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = TopicCreateSchema.safeParse({
    title: formData.get("title") ?? "",
    description: (formData.get("description") || null) as string | null,
    category: (formData.get("category") || null) as string | null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in" };
  }

  let topic: Topic;
  try {
    topic = await createTopic(supabase, user.id, parsed.data);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create topic",
    };
  }

  revalidatePath("/topics");
  revalidatePath("/dashboard");
  redirect(`/topics/${topic.id}`);
}

export async function deleteTopicAction(id: string): Promise<void> {
  const supabase = await createClient();
  await deleteTopic(supabase, id);
  revalidatePath("/topics");
  revalidatePath("/dashboard");
  redirect("/topics");
}
