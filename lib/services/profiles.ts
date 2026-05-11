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

const QuotaSchema = z
  .number()
  .int("Quota must be a whole number")
  .min(1, "Quota must be at least 1")
  .max(200, "Quota cannot exceed 200");

const DowSchema = z
  .number()
  .int("Day of week must be a whole number")
  .min(0)
  .max(6);

export const StudyPlanUpdateSchema = z.object({
  daily_quota: QuotaSchema,
  // Day-of-week ints (0=Sun .. 6=Sat) the user always skips.
  weekly_skip_days: z.array(DowSchema).max(7).default([]),
  // Sparse map: only days that override the default daily_quota appear.
  // Keys are stringified dow (0-6) — JSON object keys are always strings.
  weekly_quotas: z.record(z.string().regex(/^[0-6]$/), QuotaSchema).default({}),
});

export type StudyPlanUpdateInput = z.infer<typeof StudyPlanUpdateSchema>;

// Pure helper: the effective quota for a given day-of-week.
export function effectiveQuotaForDow(
  dow: number,
  weeklyQuotas: Record<string, number>,
  dailyQuota: number,
): number {
  return weeklyQuotas[String(dow)] ?? dailyQuota;
}

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
  // Cast: weekly_skip_days + weekly_quotas come from migration 0011 and
  // aren't in the generated types until regen.
  const update = {
    daily_quota: input.daily_quota,
    weekly_skip_days: input.weekly_skip_days,
    weekly_quotas: input.weekly_quotas,
  } as unknown as ProfileUpdate;
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

// Parses the profile's weekly_skip_days + weekly_quotas into safe shapes.
// Defensive against missing/malformed data so older profiles before the
// migration ran still render.
export function readWeeklySchedule(profile: Profile | null): {
  skipDays: Set<number>;
  quotas: Record<string, number>;
} {
  const skipDays = new Set<number>();
  const rawSkip = (profile as unknown as { weekly_skip_days?: unknown })
    ?.weekly_skip_days;
  if (Array.isArray(rawSkip)) {
    for (const v of rawSkip) {
      if (typeof v === "number" && v >= 0 && v <= 6) skipDays.add(v);
    }
  }
  const quotas: Record<string, number> = {};
  const rawQuotas = (profile as unknown as { weekly_quotas?: unknown })
    ?.weekly_quotas;
  if (rawQuotas && typeof rawQuotas === "object" && !Array.isArray(rawQuotas)) {
    for (const [k, v] of Object.entries(rawQuotas as Record<string, unknown>)) {
      if (/^[0-6]$/.test(k) && typeof v === "number" && v >= 1 && v <= 200) {
        quotas[k] = v;
      }
    }
  }
  return { skipDays, quotas };
}

// --- Skip dates ----------------------------------------------------------

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const SkipDateSchema = z
  .string()
  .regex(DATE_KEY_RE, "Date must be YYYY-MM-DD");

// Parse the jsonb skip_dates column into a Set for O(1) membership checks.
// Defensive against malformed or missing data.
export async function getSkipDates(
  client: Client,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = (await client
    .from("profiles")
    .select("skip_dates")
    .eq("id", userId)
    .maybeSingle()) as {
    data: { skip_dates: unknown } | null;
    error: Error | null;
  };
  if (error) throw error;
  const set = new Set<string>();
  const raw = data?.skip_dates;
  if (Array.isArray(raw)) {
    for (const v of raw) {
      if (typeof v === "string" && DATE_KEY_RE.test(v)) set.add(v);
    }
  }
  return set;
}

// Calls the Postgres helper (added by migration 0010) so the read-modify-
// write happens server-side and dedups against concurrent toggles.
export async function addSkipDate(client: Client, date: string): Promise<void> {
  SkipDateSchema.parse(date);
  // Cast: helper RPC isn't in the generated types until regen.
  const { error } = await (
    client.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: Error | null }>
  )("add_skip_date", { p_date: date });
  if (error) throw error;
}

export async function removeSkipDate(
  client: Client,
  date: string,
): Promise<void> {
  SkipDateSchema.parse(date);
  const { error } = await (
    client.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: Error | null }>
  )("remove_skip_date", { p_date: date });
  if (error) throw error;
}
