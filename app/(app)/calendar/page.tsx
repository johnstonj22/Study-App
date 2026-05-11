import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  effectiveQuotaForDow,
  getProfile,
  getSkipDates,
  readWeeklySchedule,
} from "@/lib/services/profiles";
import {
  getAncestorChain,
  getTopicPriorities,
  listTopics,
} from "@/lib/services/topics";
import {
  getCompletedCountsByDay,
  getItemsInWindow,
  getReviewHistoryForDay,
} from "@/lib/services/reviews";
import {
  distributeAcrossDays,
  dowFromDateKey,
  formatDateKey,
  startOfDayInTimezone,
  startOfLocalDay,
} from "@/lib/scheduler";
import {
  CalendarMonthGrid,
  type CalendarCell,
  type DayBreakdown,
} from "@/components/CalendarMonthGrid";
import {
  CalendarDayPanel,
  type DayPanelItem,
} from "@/components/CalendarDayPanel";
import type { ReviewQueueItem } from "@/lib/types/domain";

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

function isValidDayKey(raw: string | undefined): raw is string {
  return !!raw && /^\d{4}-\d{2}-\d{2}$/.test(raw);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  const dailyQuota = profile?.daily_quota ?? 10;
  const tz = profile?.timezone ?? "UTC";
  const weekly = readWeeklySchedule(profile);

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
  const monthParam = `${year}-${String(month).padStart(2, "0")}`;

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
  const [eligible, completedMap, topicPriorities, allTopics, skipDates] =
    await Promise.all([
      getItemsInWindow(supabase, new Date(0), gridEndExclusive),
      getCompletedCountsByDay(supabase, gridStart, gridEndExclusive, tz),
      getTopicPriorities(supabase),
      listTopics(supabase),
      getSkipDates(supabase, user.id),
    ]);

  // Weekly skip days expanded into specific YYYY-MM-DD keys across the visible
  // grid. Used for both the scheduler (union with one-off skip dates) and
  // the grid (to render a "weekly off" cell with no toggle). Filled below
  // during the dist-window walk and the grid-window walk.
  const weeklySkippedKeys = new Set<string>();

  // Project distribution from today (or skip entirely for fully-past months).
  const distStart = today.getTime() < gridEndExclusive.getTime() ? today : null;
  const breakdownByDate = new Map<string, DayBreakdown>();
  const bucketsByDate = new Map<string, ReviewQueueItem[]>();
  if (distStart) {
    const distDays = Math.max(
      1,
      Math.round((gridEndExclusive.getTime() - distStart.getTime()) / MS_PER_DAY),
    );
    const completedToday = completedMap.get(todayKey) ?? 0;
    const todayDow = dowFromDateKey(todayKey);
    const todayQuota = effectiveQuotaForDow(
      todayDow,
      weekly.quotas,
      dailyQuota,
    );
    const remainingQuota = Math.max(0, todayQuota - completedToday);

    // Walk the dist window once: build per-day quotas from the weekly
    // overrides and gather weekly-skipped dates within this range.
    const dailyQuotas: number[] = [];
    const [dsy, dsm, dsd] = formatDateKey(distStart, tz)
      .split("-")
      .map(Number);
    for (let i = 0; i < distDays; i++) {
      const dayStart = startOfLocalDay(dsy!, dsm!, dsd! + i, tz);
      const key = formatDateKey(dayStart, tz);
      const dow = dowFromDateKey(key);
      if (weekly.skipDays.has(dow)) weeklySkippedKeys.add(key);
      dailyQuotas.push(
        i === 0
          ? remainingQuota
          : effectiveQuotaForDow(dow, weekly.quotas, dailyQuota),
      );
    }

    const allSkipDates = new Set<string>([
      ...skipDates,
      ...weeklySkippedKeys,
    ]);

    const buckets = distributeAcrossDays(
      eligible,
      distStart,
      distDays,
      {
        dailyQuotas,
        flashcardRatio: 0.5,
        topicPriorities,
        skipDates: allSkipDates,
      },
      tz,
    );
    for (const b of buckets) {
      breakdownByDate.set(b.date, {
        total: b.items.length,
        flashcards: b.items.filter((i) => i.kind === "flashcard").length,
        shortAnswers: b.items.filter((i) => i.kind === "short_answer").length,
      });
      bucketsByDate.set(b.date, b.items);
    }
  }

  // Also flag past weekly-off days in the grid so they render as muted
  // (visual consistency; doesn't change any computation).
  if (weekly.skipDays.size > 0) {
    const [gsy0, gsm0, gsd0] = formatDateKey(gridStart, tz)
      .split("-")
      .map(Number);
    for (let i = 0; i < gridDayCount; i++) {
      const dayStart = startOfLocalDay(gsy0!, gsm0!, gsd0! + i, tz);
      const key = formatDateKey(dayStart, tz);
      if (weekly.skipDays.has(dowFromDateKey(key))) {
        weeklySkippedKeys.add(key);
      }
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

  // ----- Day panel ---------------------------------------------------------
  // Selected day either comes from `?day=`, or defaults to today (if the
  // current month grid contains today). This way the panel is always present
  // when there's something natural to show.
  const explicitDay = isValidDayKey(params.day) ? params.day! : null;
  const selectedDay =
    explicitDay ?? (cells.some((c) => c.isToday) ? todayKey : null);

  let panelItems: DayPanelItem[] = [];
  let panelMode: "past" | "today" | "future" = "future";
  let panelDateLabel = "";
  if (selectedDay) {
    const [sy, sm, sd] = selectedDay.split("-").map(Number);
    const dayStart = startOfLocalDay(sy!, sm!, sd!, tz);
    const dayEnd = startOfLocalDay(sy!, sm!, sd! + 1, tz);
    panelDateLabel = formatPanelDate(sy!, sm!, sd!);

    if (dayStart.getTime() < today.getTime()) {
      panelMode = "past";
      const history = await getReviewHistoryForDay(supabase, dayStart, dayEnd);
      panelItems = history.map((h) => ({
        kind: h.kind,
        label: h.label,
        topicId: h.topic_id,
        rating: h.rating,
      }));
    } else {
      panelMode = selectedDay === todayKey ? "today" : "future";
      const items = bucketsByDate.get(selectedDay) ?? [];
      panelItems = items.map((it) => ({
        kind: it.kind,
        label: it.kind === "flashcard" ? it.front : it.prompt,
        topicId: it.topic_id,
      }));
    }
  }

  // Topic-path map for the panel grouping.
  const topicsById = new Map(allTopics.map((t) => [t.id, t]));
  const topicPaths = new Map<string, string>();
  for (const t of allTopics) {
    topicPaths.set(
      t.id,
      getAncestorChain(t.id, topicsById)
        .map((a) => a.title)
        .join(" / "),
    );
  }

  const prevMonth = shiftMonth(year, month, -1);
  const nextMonth = shiftMonth(year, month, +1);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <CalendarMonthGrid
          cells={cells}
          month={monthParam}
          selectedDay={selectedDay ?? undefined}
          skipDates={skipDates}
          weeklySkippedDates={weeklySkippedKeys}
        />
        {selectedDay && (
          <CalendarDayPanel
            dateLabel={panelDateLabel}
            mode={panelMode}
            items={panelItems}
            topicPaths={topicPaths}
          />
        )}
      </div>
    </div>
  );
}

function formatPanelDate(y: number, m: number, d: number): string {
  // Stable Y-M-D in user's tz; format like "May 10, 2026".
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}
