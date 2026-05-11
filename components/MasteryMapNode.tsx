"use client";

import Link from "next/link";
import { Handle, Position, type NodeProps } from "@xyflow/react";

// Node data shape consumed by react-flow. The map computes radius and
// passes it in so the renderer is purely presentational.
export type MasteryNodeData = {
  title: string;
  mastery: number;
  flashcards: number;
  shortAnswers: number;
  radius: number;
  isFocus: boolean;
  isOverall: boolean;
  topicId: string | null;
  parentId: string | null;
  onOpenParent: ((parentId: string) => void) | null;
};

export function MasteryMapNode({ data }: NodeProps) {
  const d = data as unknown as MasteryNodeData;
  const diameter = d.radius * 2;
  const totalQ = d.flashcards + d.shortAnswers;
  const masteryDisplay = Math.round(d.mastery);

  // Color shifts from rose (low mastery) → emerald (high). The user reads
  // this fast even before the percentage registers.
  const hue = Math.round((d.mastery / 100) * 130); // 0=red, 130=emerald
  const bg = `hsl(${hue}, 70%, 92%)`;
  const border = `hsl(${hue}, 50%, 55%)`;

  return (
    <div
      style={{
        width: diameter,
        height: diameter,
        background: bg,
        borderColor: border,
      }}
      className={
        "relative flex items-center justify-center rounded-full border-2 text-center transition " +
        (d.isFocus ? "shadow-lg ring-2 ring-zinc-900 dark:ring-zinc-100" : "")
      }
    >
      {/* Hidden source/target handles so react-flow can render edges. */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      <div className="flex flex-col items-center justify-center px-2 leading-tight text-zinc-900">
        <p className="line-clamp-2 text-[11px] font-semibold">
          {d.isOverall ? "Overall" : d.title}
        </p>
        <p className="text-base font-bold tabular-nums">{masteryDisplay}%</p>
        {totalQ > 0 && (
          <p className="text-[10px] tabular-nums opacity-75">
            {totalQ} Q · F:{d.flashcards} · S:{d.shortAnswers}
          </p>
        )}
        {d.isFocus && !d.isOverall && d.topicId && (
          <div className="absolute -bottom-9 left-1/2 flex -translate-x-1/2 gap-1 whitespace-nowrap">
            {d.parentId && d.onOpenParent && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  d.onOpenParent!(d.parentId!);
                }}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                ↑ Parent
              </button>
            )}
            <Link
              href={`/topics/${d.topicId}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Open
            </Link>
          </div>
        )}
        {d.isFocus && d.isOverall && (
          <div className="absolute -bottom-9 left-1/2 -translate-x-1/2">
            <Link
              href="/topics"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              All topics
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
