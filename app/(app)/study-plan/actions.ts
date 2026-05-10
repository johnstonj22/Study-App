"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  StudyPlanUpdateSchema,
  updateStudyPlan,
} from "@/lib/services/profiles";
import {
  TopicPriorityUpdateSchema,
  updateTopicPriorities,
} from "@/lib/services/topics";

export type FormState = { error: string | null; saved: boolean };

export async function updateStudyPlanAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formData.get("daily_quota");
  const parsed = StudyPlanUpdateSchema.safeParse({
    daily_quota: Number(raw),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      saved: false,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in", saved: false };
  }

  try {
    await updateStudyPlan(supabase, user.id, parsed.data);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update study plan",
      saved: false,
    };
  }

  revalidatePath("/study-plan");
  revalidatePath("/calendar");
  revalidatePath("/review");
  revalidatePath("/dashboard");
  return { error: null, saved: true };
}

// Form-data shape: any number of `priority_<topic_id>` fields, each holding
// a numeric string. Validates each row through TopicPriorityUpdateSchema and
// updates them in parallel. RLS scopes each row to the caller.
export async function updateTopicPrioritiesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const updates: { id: string; priority: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("priority_")) continue;
    const id = key.slice("priority_".length);
    const parsed = TopicPriorityUpdateSchema.safeParse({
      id,
      priority: Number(value),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid priority",
        saved: false,
      };
    }
    updates.push(parsed.data);
  }
  if (updates.length === 0) {
    return { error: null, saved: true };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in", saved: false };
  }

  try {
    await updateTopicPriorities(supabase, updates);
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to update priorities",
      saved: false,
    };
  }

  revalidatePath("/study-plan");
  revalidatePath("/calendar");
  revalidatePath("/review");
  revalidatePath("/dashboard");
  revalidatePath("/topics");
  return { error: null, saved: true };
}
