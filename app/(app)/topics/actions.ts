"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  SubTopicSplitSpecSchema,
  TopicCreateSchema,
  convertLeafToBranch,
  createTopic,
  deleteTopic,
  moveQuestions,
} from "@/lib/services/topics";
import type { SubTopicSplitSpec } from "@/lib/services/topics";
import type { Topic } from "@/lib/types/domain";

export type FormState = { error: string | null };

// Optional `parentId` is bound at the call site (e.g. for the "Add sub-topic"
// flow). When null, the topic is created at root level.
export async function createTopicAction(
  parentId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = TopicCreateSchema.safeParse({
    title: formData.get("title") ?? "",
    description: (formData.get("description") || null) as string | null,
    category: (formData.get("category") || null) as string | null,
    parent_id: parentId,
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
  if (parentId) {
    revalidatePath(`/topics/${parentId}`);
  }
  redirect(`/topics/${topic.id}`);
}

export async function deleteTopicAction(id: string): Promise<void> {
  const supabase = await createClient();
  await deleteTopic(supabase, id);
  revalidatePath("/topics");
  revalidatePath("/dashboard");
  redirect("/topics");
}

// Splits a leaf topic with existing questions into sub-topics in one
// transaction. The form encodes:
//   - one `subtopic_<idx>_title` field per new sub-topic
//   - one `assign_<itemKind>_<itemId>` field per existing question, value =
//     the index of the sub-topic it is being moved to
export async function convertLeafToBranchAction(
  parentTopicId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Collect sub-topic titles by index.
  const titlesByIndex = new Map<number, string>();
  for (const [key, value] of formData.entries()) {
    const m = /^subtopic_(\d+)_title$/.exec(key);
    if (!m) continue;
    const idx = Number(m[1]);
    if (typeof value === "string") titlesByIndex.set(idx, value);
  }
  if (titlesByIndex.size < 1) {
    return { error: "Add at least one sub-topic." };
  }

  const indexes = [...titlesByIndex.keys()].sort((a, b) => a - b);
  const specs: SubTopicSplitSpec[] = indexes.map((i) => ({
    title: titlesByIndex.get(i) ?? "",
    flashcard_ids: [],
    short_answer_ids: [],
  }));
  const specByIndex = new Map(indexes.map((i, pos) => [i, pos]));

  // Collect question assignments. Reject anything unassigned (we treat empty
  // string as "not assigned").
  let unassigned = 0;
  for (const [key, value] of formData.entries()) {
    const fc = /^assign_flashcard_([0-9a-f-]+)$/.exec(key);
    const sa = /^assign_short_answer_([0-9a-f-]+)$/.exec(key);
    if (!fc && !sa) continue;
    const id = (fc ?? sa)![1]!;
    const raw = typeof value === "string" ? value.trim() : "";
    if (raw === "") {
      unassigned += 1;
      continue;
    }
    const idx = Number(raw);
    const pos = specByIndex.get(idx);
    if (pos === undefined) {
      return { error: "A question is assigned to an unknown sub-topic." };
    }
    if (fc) specs[pos]!.flashcard_ids.push(id);
    else specs[pos]!.short_answer_ids.push(id);
  }
  if (unassigned > 0) {
    return {
      error: `Assign every question to a sub-topic (${unassigned} left).`,
    };
  }

  // Validate spec shapes.
  for (const s of specs) {
    const parsed = SubTopicSplitSpecSchema.safeParse(s);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid sub-topic" };
    }
  }

  try {
    await convertLeafToBranch(supabase, parentTopicId, specs);
  } catch (err) {
    // Surface PostgrestError shapes too — they're plain objects, not Error
    // instances, so the bare `err.message` check would otherwise drop the
    // useful detail.
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to split topic";
    return { error: msg };
  }

  revalidatePath("/topics");
  revalidatePath("/dashboard");
  revalidatePath(`/topics/${parentTopicId}`);
  redirect(`/topics/${parentTopicId}`);
}

// Moves a set of questions from `sourceTopicId` to a target topic chosen in
// the form. The form encodes:
//   - `target_topic_id`: the destination (must be a leaf)
//   - one `move_flashcard_<id>` checkbox per flashcard checked for moving
//   - one `move_short_answer_<id>` checkbox per short-answer checked for moving
export async function moveQuestionsAction(
  sourceTopicId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const targetRaw = formData.get("target_topic_id");
  const targetTopicId =
    typeof targetRaw === "string" && targetRaw.trim() !== "" ? targetRaw : null;
  if (!targetTopicId) {
    return { error: "Choose a destination topic." };
  }

  const flashcardIds: string[] = [];
  const shortAnswerIds: string[] = [];
  for (const [key] of formData.entries()) {
    const fc = /^move_flashcard_([0-9a-f-]+)$/.exec(key);
    const sa = /^move_short_answer_([0-9a-f-]+)$/.exec(key);
    if (fc) flashcardIds.push(fc[1]!);
    else if (sa) shortAnswerIds.push(sa[1]!);
  }

  if (flashcardIds.length === 0 && shortAnswerIds.length === 0) {
    return { error: "Select at least one question to move." };
  }

  try {
    await moveQuestions(
      supabase,
      sourceTopicId,
      targetTopicId,
      flashcardIds,
      shortAnswerIds,
    );
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to move questions";
    return { error: msg };
  }

  revalidatePath("/topics");
  revalidatePath("/dashboard");
  revalidatePath(`/topics/${sourceTopicId}`);
  revalidatePath(`/topics/${targetTopicId}`);
  redirect(`/topics/${sourceTopicId}`);
}
