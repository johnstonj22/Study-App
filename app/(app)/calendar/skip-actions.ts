"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  addSkipDate,
  getProfile,
  getSkipDates,
  removeSkipDate,
  SkipDateSchema,
} from "@/lib/services/profiles";
import {
  startOfDayInTimezone,
  startOfLocalDay,
} from "@/lib/scheduler";

// Toggles a date in the user's skip_dates jsonb array. Driven by the small
// per-cell form on /calendar future cells. Past + today cells never render
// the toggle (the page guards against it server-side too).
export async function toggleSkipDateAction(formData: FormData): Promise<void> {
  const date = String(formData.get("date") ?? "");
  const parsed = SkipDateSchema.safeParse(date);
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Don't let a stale/future click skip the past or today. Compare in the
  // user's tz so a midnight-edge click resolves correctly.
  const profile = await getProfile(supabase, user.id);
  const tz = profile?.timezone ?? "UTC";
  const today = startOfDayInTimezone(new Date(), tz);
  const [y, m, d] = date.split("-").map(Number);
  const dayStart = startOfLocalDay(y!, m!, d!, tz);
  if (dayStart.getTime() <= today.getTime()) return;

  const current = await getSkipDates(supabase, user.id);
  if (current.has(date)) {
    await removeSkipDate(supabase, date);
  } else {
    await addSkipDate(supabase, date);
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}
