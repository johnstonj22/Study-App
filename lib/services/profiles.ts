// Profiles service. PURE: takes a SupabaseClient, no Next/React imports.
//
// The profile row is auto-created by an auth trigger (see migration 0003)
// when a user signs up, so we always expect getProfile to find a row for an
// authenticated caller.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile, ProfileUpdate } from "../types/domain";

type Client = SupabaseClient<Database>;

// --- Validation schemas --------------------------------------------------

export const StudyPlanUpdateSchema = z.object({
  daily_quota: z
    .number()
    .int("Daily quota must be a whole number")
    .min(1, "Daily quota must be at least 1")
    .max(200, "Daily quota cannot exceed 200"),
});

export type StudyPlanUpdateInput = z.infer<typeof StudyPlanUpdateSchema>;

// Validates an IANA timezone identifier by feeding it to Intl. Anything the
// runtime's tz database accepts is fine; everything else throws and fails
// the refinement.
export const TimezoneSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Invalid timezone");

// --- Service functions ---------------------------------------------------

export async function getProfile(
  client: Client,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateStudyPlan(
  client: Client,
  userId: string,
  input: StudyPlanUpdateInput,
): Promise<Profile> {
  const update: ProfileUpdate = { daily_quota: input.daily_quota };
  const { data, error } = await client
    .from("profiles")
    .update(update)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTimezone(
  client: Client,
  userId: string,
  timezone: string,
): Promise<void> {
  const update: ProfileUpdate = { timezone };
  const { error } = await client
    .from("profiles")
    .update(update)
    .eq("id", userId);
  if (error) throw error;
}
