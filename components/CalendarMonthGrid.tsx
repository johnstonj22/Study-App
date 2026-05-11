import Link from "next/link";
import { toggleSkipDateAction } from "@/app/(app)/calendar/skip-actions";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type DayBreakdown = {
  total: number;
  flashcards: number;
  shortAnswers: number;
};

export type CalendarCell = {
  key: string; // YYYY-MM-DD
  day: number; // 1-31
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  completed: number;
  bucket?: DayBreakdown;
};

export function CalendarMonthGrid({
  cells,
  month,
  selectedDay,
  skipDates,
  weeklySkippedDates,
}: {
  cells: CalendarCell[];
  // Current `?month=YYYY-MM` value, so cell links preserve the month context.
  month: string;
  // Currently-selected day (YYYY-MM-DD). When set, that cell renders with
  // a distinct ring.
  selectedDay?: string;
  // One-off skip dates the user toggled directly. The per-cell button
  // toggles membership in this set.
  skipDates: Set<string>;
  // Dates that fall on a weekly-skipped day-of-week. These render muted
  // and "Off" with no toggle (the user changes them via /study-plan).
  weeklySkippedDates: Set<string>;
}) {
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-zinc-200 pb-1 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {DOW.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-800">
        {cells.map((cell) => (
          <CellView
            key={cell.key}
            cell={cell}
            month={month}
            selectedDay={selectedDay}
            isOneOffSkipped={skipDates.has(cell.key)}
            isWeeklySkipped={weeklySkippedDates.has(cell.key)}
          />
        ))}
      </div>
    </div>
  );
}

function CellView({
  cell,
  month,
  selectedDay,
  isOneOffSkipped,
  isWeeklySkipped,
}: {
  cell: CalendarCell;
  month: string;
  selectedDay?: string;
  isOneOffSkipped: boolean;
  isWeeklySkipped: boolean;
}) {
  const isSkipped = isOneOffSkipped || isWeeklySkipped;
  const bucketTotal = cell.bucket?.total ?? 0;
  const todayDisplayedTotal = cell.completed + bucketTotal;
  const isSelected = selectedDay === cell.key;
  const isFuture = !cell.isPast && !cell.isToday;

  // Selected ring beats today ring when both apply.
  const ring = isSelected
    ? "ring-2 ring-blue-500 dark:ring-blue-400"
    : cell.isToday
      ? "ring-2 ring-zinc-900 dark:ring-zinc-100"
      : "";

  const baseBg = isSkipped
    ? "bg-zinc-100 dark:bg-zinc-900"
    : "bg-white dark:bg-zinc-950";
  const linkCls = [
    "block min-h-24 p-1.5 text-xs transition hover:bg-zinc-50 dark:hover:bg-zinc-900",
    baseBg,
    cell.inMonth
      ? "text-zinc-900 dark:text-zinc-100"
      : "text-zinc-400 dark:text-zinc-600",
    ring,
    isSkipped ? "opacity-70" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const href = `/calendar?month=${month}&day=${cell.key}`;

  return (
    <div className="relative">
      <Link href={href} className={linkCls} scroll={false}>
        <div className="font-medium">{cell.day}</div>
        {isSkipped && (isFuture || cell.isPast) ? (
          <div className="mt-1 italic text-zinc-500 dark:text-zinc-400">
            {isWeeklySkipped ? "Weekly off" : "Skipped"}
          </div>
        ) : cell.isToday ? (
          <div className="mt-1 space-y-0.5">
            <div className="font-semibold">
              {cell.completed} / {todayDisplayedTotal}
            </div>
            {cell.bucket && cell.bucket.total > 0 && (
              <TypeBreakdown bucket={cell.bucket} />
            )}
          </div>
        ) : cell.isPast ? (
          cell.completed > 0 ? (
            <div className="mt-1 text-zinc-500 dark:text-zinc-400">
              {cell.completed} done
            </div>
          ) : null
        ) : (
          bucketTotal > 0 && (
            <div className="mt-1 space-y-0.5">
              <div className="font-semibold">{bucketTotal}</div>
              <TypeBreakdown bucket={cell.bucket!} />
            </div>
          )
        )}
      </Link>
      {/* Skip toggle is a sibling of the Link so its click doesn't navigate.
          Past + today cells never get one. Weekly-off cells don't get one
          either — the user manages those via /study-plan. */}
      {isFuture && !isWeeklySkipped && (
        <form action={toggleSkipDateAction} className="absolute right-1 top-1">
          <input type="hidden" name="date" value={cell.key} />
          <button
            type="submit"
            className={
              "rounded px-1.5 py-0.5 text-[10px] font-medium transition " +
              (isOneOffSkipped
                ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                : "border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900")
            }
          >
            {isOneOffSkipped ? "Unskip" : "Skip"}
          </button>
        </form>
      )}
    </div>
  );
}

function TypeBreakdown({ bucket }: { bucket: DayBreakdown }) {
  const parts: string[] = [];
  if (bucket.flashcards > 0) parts.push(`F: ${bucket.flashcards}`);
  if (bucket.shortAnswers > 0) parts.push(`S: ${bucket.shortAnswers}`);
  if (parts.length === 0) return null;
  return (
    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
      {parts.join(" · ")}
    </div>
  );
}
