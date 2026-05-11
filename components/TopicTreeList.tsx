import Link from "next/link";
import type { TopicTreeNode } from "@/lib/types/domain";

// Recursive renderer for the topic tree on /topics. Each node links to its
// detail page; children are indented one level. Leaf nodes (no children)
// render a "Leaf" hint; branches render a child count.
//
// Pure presentational — depth is propagated for indentation only. Mastery is
// looked up from the computed map (see computeTopicMasteryTree).
export function TopicTreeList({
  nodes,
  masteryMap,
}: {
  nodes: TopicTreeNode[];
  masteryMap: Map<string, number>;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <TopicTreeRow
          key={node.id}
          node={node}
          depth={0}
          masteryMap={masteryMap}
        />
      ))}
    </ul>
  );
}

function TopicTreeRow({
  node,
  depth,
  masteryMap,
}: {
  node: TopicTreeNode;
  depth: number;
  masteryMap: Map<string, number>;
}) {
  const isBranch = node.children.length > 0;
  const mastery = Math.round(masteryMap.get(node.id) ?? 0);
  return (
    <li>
      <Link
        href={`/topics/${node.id}`}
        style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}
        className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="text-zinc-400 dark:text-zinc-600"
            title={isBranch ? "Branch" : "Leaf"}
          >
            {isBranch ? "▸" : "•"}
          </span>
          <span className="truncate text-sm font-medium">{node.title}</span>
          {isBranch && (
            <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
              {node.children.length} sub-topic
              {node.children.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {mastery}%
        </span>
      </Link>
      {isBranch && (
        <ul className="mt-1 space-y-1">
          {node.children.map((child) => (
            <TopicTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              masteryMap={masteryMap}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
