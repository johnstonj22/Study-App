import Link from "next/link";

// Unified shape rendered by the panel. The calling page maps either projected
// queue items or reviewed history rows into this list.
export type DayPanelItem = {
  kind: "flashcard" | "short_answer";
  label: string;
  topicId: string | null;
  rating?: "again" | "hard" | "good" | "easy";
};

const RATING_TONE: Record<string, string> = {
  again: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  hard: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  easy: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
};

export function CalendarDayPanel({
  dateLabel,
  mode,
  items,
  topicPaths,
}: {
  dateLabel: string;
  mode: "past" | "today" | "future";
  items: DayPanelItem[];
  topicPaths: Map<string, string>;
}) {
  const heading =
    mode === "past"
      ? "Reviewed"
      : mode === "today"
        ? "Today's bucket"
        : "Projected bucket";
  const subtitle =
    mode === "past"
      ? "Items you reviewed this day."
      : mode === "today"
        ? "Items remaining in today's quota."
        : "Items planned for this day.";

  // Group by topic. Items without a topic id (orphaned history) bucket together
  // under a "(no topic)" key.
  const byTopic = new Map<string, DayPanelItem[]>();
  for (const it of items) {
    const key = it.topicId ?? "__none__";
    const arr = byTopic.get(key) ?? [];
    arr.push(it);
    byTopic.set(key, arr);
  }

  return (
    <section
      aria-label="Day detail"
      className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {dateLabel}
        </p>
        <h2 className="text-base font-semibold">{heading}</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        <p className="pt-1 text-sm tabular-nums">
          {items.length} item{items.length === 1 ? "" : "s"}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nothing here.
        </p>
      ) : (
        <ul className="space-y-3">
          {[...byTopic.entries()].map(([topicKey, group]) => {
            const topicId = topicKey === "__none__" ? null : topicKey;
            const path =
              topicId && topicPaths.get(topicId)
                ? topicPaths.get(topicId)!
                : "(no topic)";
            const fcCount = group.filter((g) => g.kind === "flashcard").length;
            const saCount = group.length - fcCount;
            return (
              <li key={topicKey} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  {topicId ? (
                    <Link
                      href={`/topics/${topicId}`}
                      className="truncate text-sm font-medium underline"
                    >
                      {path}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-medium text-zinc-500">
                      {path}
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
                    {fcCount > 0 && `F:${fcCount}`}
                    {fcCount > 0 && saCount > 0 && " · "}
                    {saCount > 0 && `S:${saCount}`}
                  </span>
                </div>
                <ul className="space-y-1">
                  {group.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-900"
                    >
                      <span className="shrink-0 rounded-sm bg-zinc-200 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {it.kind === "flashcard" ? "F" : "S"}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {it.label}
                      </span>
                      {it.rating && (
                        <span
                          className={`shrink-0 rounded-sm px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${RATING_TONE[it.rating]}`}
                        >
                          {it.rating}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
