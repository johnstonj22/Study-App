"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  TimezoneSchema,
  getProfile,
  updateTimezone,
} from "@/lib/services/profiles";

// Server action invoked once per session by <TimezoneSync>. Idempotent:
// reads the stored timezone and only writes (and revalidates) when the
// browser-detected value differs. Silent on failure — a wrong tz is a UX
// nuisance, not worth surfacing as an error.
export async function syncTimezoneAction(timezone: string): Promise<void> {
  const parsed = TimezoneSchema.safeParse(timezone);
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await getProfile(supabase, user.id);
  if (!profile || profile.timezone === parsed.data) return;

  await updateTimezone(supabase, user.id, parsed.data);
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/review");
  revalidatePath("/study-plan");
}
