"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateReviewUpdate } from "@/lib/scheduler";
import { recordReview } from "@/lib/services/reviews";
import type { Rating, ReviewItemType } from "@/lib/types/domain";

export async function rateItemAction(
  itemType: ReviewItemType,
  itemId: string,
  rating: Rating,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Fetch the current mastery score from the appropriate table.
  // RLS scopes this to the caller's rows, so the user can't rate someone
  // else's item even by submitting a foreign UUID.
  const table =
    itemType === "flashcard" ? "flashcards" : "short_answer_questions";
  const { data, error } = await supabase
    .from(table)
    .select("mastery_score")
    .eq("id", itemId)
    .single();

  if (error || !data) throw new Error("Item not found");

  const now = new Date();
  const update = calculateReviewUpdate(
    Number(data.mastery_score),
    rating,
    now,
  );

  await recordReview(supabase, {
    itemType,
    itemId,
    rating,
    newMasteryScore: update.mastery_score,
    nextReviewAt: update.next_review_at,
    now,
  });

  revalidatePath("/review");
  revalidatePath("/dashboard");
}
