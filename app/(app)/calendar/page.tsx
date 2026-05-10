import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/services/profiles";
import { getTopicPriorities } from "@/lib/services/topics";
import {
  getCompletedCountsByDay,
  getItemsInWindow,
} from "@/lib/services/reviews";
import {
  distributeAcrossDays,
  formatDateKey,
  startOfDayInTimezone,
  startOfLocalDay,
} from "@/lib/scheduler";
import {
  CalendarMonthGrid,
  type CalendarCell,
  type DayBreakdown,
} from "@/components/CalendarMonthGrid";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseMonthParam(
  raw: string | undefined,
  fallback: { year: number; month: number },
): { year: number; month: number } {
  if (raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    return { year: y!, month: m! };
  }
  return fallback;
}

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  const dailyQuota = profile?.daily_quota ?? 10;
  const tz = profile?.timezone ?? "UTC";

  const params = await searchParams;
  const today = startOfDayInTimezone(new Date(), tz);
  // Use the local Y-M-D of today as the default month, so a user in UTC+10
  // viewing the calendar at UTC 22:00 sees their local "tomorrow's" month
  // when appropriate.
  const todayKey = formatDateKey(today, tz);
  const [tyDefault, tmDefault] = todayKey.split("-").map(Number);
  const { year, month } = parseMonthParam(params.month, {
    year: tyDefault!,
    month: tmDefault!,
  });

  // Grid range: Sunday-on-or-before the 1st through Saturday-on-or-after the
  // last of the month, expressed in the user's tz. Day-of-week is calendar-
  // deterministic (May 1, 2026 is Friday everywhere), so we can compute it
  // via UTC arithmetic on plain Y-M-D values without touching the local clock.
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const gridStart = startOfLocalDay(year, month, 1 - firstDow, tz);
  const lastOfMonthCal = new Date(Date.UTC(year, month, 0));
  const lastDow = lastOfMonthCal.getUTCDay();
  const gridEndExclusive = startOfLocalDay(
    year,
    month,
    lastOfMonthCal.getUTCDate() + (7 - lastDow),
    tz,
  );
  const gridDayCount = Math.round(
    (gridEndExclusive.getTime() - gridStart.getTime()) / MS_PER_DAY,
  );

  // Pull every item due strictly before gridEnd so the distribution can place
  // each into its day. Lower bound is 0 to include overdue items in today's
  // bucket.
  const [eligible, completedMap, topicPriorities] = await Promise.all([
    getItemsInWindow(supabase, new Date(0), gridEndExclusive),
    getCompletedCountsByDay(supabase, gridStart, gridEndExclusive, tz),
    getTopicPriorities(supabase),
  ]);

  // Project distribution from today (or skip entirely for fully-past months).
  const distStart = today.getTime() < gridEndExclusive.getTime() ? today : null;
  const breakdownByDate = new Map<string, DayBreakdown>();
  if (distStart) {
    const distDays = Math.max(
      1,
      Math.round((gridEndExclusive.getTime() - distStart.getTime()) / MS_PER_DAY),
    );
    const completedToday = completedMap.get(todayKey) ?? 0;
    const remainingQuota = Math.max(0, dailyQuota - completedToday);
    const dailyQuotas = Array.from({ length: distDays }, (_, i) =>
      i === 0 ? remainingQuota : dailyQuota,
    );
    const buckets = distributeAcrossDays(
      eligible,
      distStart,
      distDays,
      { dailyQuotas, flashcardRatio: 0.5, topicPriorities },
      tz,
    );
    for (const b of buckets) {
      breakdownByDate.set(b.date, {
        total: b.items.length,
        flashcards: b.items.filter((i) => i.kind === "flashcard").length,
        shortAnswers: b.items.filter((i) => i.kind === "short_answer").length,
      });
    }
  }

  // Build the list of cells the grid renders. Walks calendar days starting
  // from the first cell's local Y-M-D, calling startOfLocalDay each iteration
  // so DST transitions don't shift the boundary.
  const [gsy, gsm, gsd] = formatDateKey(gridStart, tz).split("-").map(Number);
  const cells: CalendarCell[] = Array.from({ length: gridDayCount }, (_, i) => {
    const dayStart = startOfLocalDay(gsy!, gsm!, gsd! + i, tz);
    const key = formatDateKey(dayStart, tz);
    const [cy, cm, cd] = key.split("-").map(Number);
    return {
      key,
      day: cd!,
      inMonth: cy === year && cm === month,
      isToday: key === todayKey,
      isPast: dayStart.getTime() < today.getTime(),
      completed: completedMap.get(key) ?? 0,
      bucket: breakdownByDate.get(key),
    };
  });

  const prevMonth = shiftMonth(year, month, -1);
  const nextMonth = shiftMonth(year, month, +1);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-baseline justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Calendar</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {dailyQuota} questions per day ·{" "}
            <Link href="/study-plan" className="underline">
              edit
            </Link>
          </p>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href={`/calendar?month=${prevMonth}`}
            className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ←
          </Link>
          <span className="min-w-32 text-center font-medium">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Link
            href={`/calendar?month=${nextMonth}`}
            className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            →
          </Link>
          <Link
            href="/calendar"
            className="ml-2 rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Today
          </Link>
        </nav>
      </div>

      <CalendarMonthGrid cells={cells} />
    </div>
  );
}
