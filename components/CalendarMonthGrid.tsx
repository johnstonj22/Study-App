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

export function CalendarMonthGrid({ cells }: { cells: CalendarCell[] }) {
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-zinc-200 pb-1 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {DOW.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-800">
        {cells.map((cell) => {
          const bucketTotal = cell.bucket?.total ?? 0;
          const todayDisplayedTotal = cell.completed + bucketTotal;
          const cls = [
            "min-h-24 bg-white p-1.5 text-xs dark:bg-zinc-950",
            cell.inMonth
              ? "text-zinc-900 dark:text-zinc-100"
              : "text-zinc-400 dark:text-zinc-600",
            cell.isToday ? "ring-2 ring-zinc-900 dark:ring-zinc-100" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={cell.key} className={cls}>
              <div className="font-medium">{cell.day}</div>
              {cell.isToday ? (
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
            </div>
          );
        })}
      </div>
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
