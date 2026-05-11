"use client";

import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Topic, TopicTreeNode } from "@/lib/types/domain";
import { MasteryMapNode, type MasteryNodeData } from "./MasteryMapNode";

// Synthetic id used for the "Overall" node at the root view.
const OVERALL_ID = "__overall__";

const NODE_TYPES = { mastery: MasteryMapNode };

// Map mastery (0-100) to a circle radius in px. Larger circles = higher
// mastery (the user's intuition: more solid knowledge takes up more space).
function masteryToRadius(mastery: number): number {
  return 36 + (Math.max(0, Math.min(100, mastery)) / 100) * 36; // 36..72
}

// Map child mastery to an edge opacity. Faded edges indicate weaker areas.
function masteryToOpacity(mastery: number): number {
  return 0.2 + (Math.max(0, Math.min(100, mastery)) / 100) * 0.8;
}

// Place N children on a circle of `radius` around the origin, starting at
// the top and spacing equally clockwise.
function radialOffsets(
  count: number,
  radius: number,
): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

export function MasteryMap({
  tree,
  masteryMap,
  overallMastery,
  countsByTopic,
  flatTopics,
}: {
  tree: TopicTreeNode[];
  masteryMap: Map<string, number>;
  overallMastery: number;
  countsByTopic: Map<string, { flashcards: number; shortAnswers: number }>;
  // Flat list — needed for parent lookups so the focus node can render an
  // "↑ Parent" button.
  flatTopics: Topic[];
}) {
  const [focusId, setFocusId] = useState<string | null>(null);

  // Quick lookup helpers built once per render.
  const { topicsById, childrenByParent, parentById } = useMemo(() => {
    const byId = new Map<string, Topic>();
    const childrenMap = new Map<string | null, Topic[]>();
    const parentMap = new Map<string, string | null>();
    for (const t of flatTopics) {
      byId.set(t.id, t);
      parentMap.set(t.id, t.parent_id);
      const arr = childrenMap.get(t.parent_id) ?? [];
      arr.push(t);
      childrenMap.set(t.parent_id, arr);
    }
    return {
      topicsById: byId,
      childrenByParent: childrenMap,
      parentById: parentMap,
    };
  }, [flatTopics]);

  // The focus topic and its visible children. focusId === null = "Overall"
  // root view, in which case the children are root topics.
  const { focusTopic, children } = useMemo(() => {
    if (focusId === null) {
      return {
        focusTopic: null as Topic | null,
        children: childrenByParent.get(null) ?? [],
      };
    }
    return {
      focusTopic: topicsById.get(focusId) ?? null,
      children: childrenByParent.get(focusId) ?? [],
    };
  }, [focusId, childrenByParent, topicsById]);

  const RADIAL_DISTANCE = 240;

  // Compute focus radius first so the children form a ring outside it.
  const focusMastery = focusTopic
    ? (masteryMap.get(focusTopic.id) ?? 0)
    : overallMastery;
  const focusRadius = masteryToRadius(focusMastery);
  const focusCounts = focusTopic
    ? (countsByTopic.get(focusTopic.id) ?? { flashcards: 0, shortAnswers: 0 })
    : aggregateCounts(tree, countsByTopic);

  const offsets = radialOffsets(children.length, RADIAL_DISTANCE);

  const nodes = useMemo<Node[]>(() => {
    const focusData: MasteryNodeData = {
      title: focusTopic?.title ?? "Overall",
      mastery: focusMastery,
      flashcards: focusCounts.flashcards,
      shortAnswers: focusCounts.shortAnswers,
      radius: focusRadius,
      isFocus: true,
      isOverall: focusTopic === null,
      topicId: focusTopic?.id ?? null,
      parentId: focusTopic ? (parentById.get(focusTopic.id) ?? null) : null,
      onOpenParent: (parentId: string) => setFocusId(parentId),
    };

    const focusNode: Node = {
      id: focusTopic?.id ?? OVERALL_ID,
      type: "mastery",
      position: { x: -focusRadius, y: -focusRadius },
      data: focusData as unknown as Record<string, unknown>,
      draggable: false,
      selectable: false,
    };

    const childNodes: Node[] = children.map((c, i) => {
      const r = masteryToRadius(masteryMap.get(c.id) ?? 0);
      const off = offsets[i]!;
      const counts = countsByTopic.get(c.id) ?? {
        flashcards: 0,
        shortAnswers: 0,
      };
      const data: MasteryNodeData = {
        title: c.title,
        mastery: masteryMap.get(c.id) ?? 0,
        flashcards: counts.flashcards,
        shortAnswers: counts.shortAnswers,
        radius: r,
        isFocus: false,
        isOverall: false,
        topicId: c.id,
        parentId: parentById.get(c.id) ?? null,
        onOpenParent: null,
      };
      return {
        id: c.id,
        type: "mastery",
        position: { x: off.x - r, y: off.y - r },
        data: data as unknown as Record<string, unknown>,
        draggable: false,
        selectable: false,
      };
    });

    return [focusNode, ...childNodes];
  }, [
    focusTopic,
    focusRadius,
    focusMastery,
    focusCounts.flashcards,
    focusCounts.shortAnswers,
    children,
    offsets,
    masteryMap,
    countsByTopic,
    parentById,
  ]);

  const edges = useMemo<Edge[]>(() => {
    const focusNodeId = focusTopic?.id ?? OVERALL_ID;
    return children.map((c) => {
      const m = masteryMap.get(c.id) ?? 0;
      return {
        id: `e-${focusNodeId}-${c.id}`,
        source: focusNodeId,
        target: c.id,
        style: {
          stroke: "currentColor",
          strokeWidth: 2,
          opacity: masteryToOpacity(m),
        },
      };
    });
  }, [children, focusTopic, masteryMap]);

  const isLeaf = children.length === 0 && focusTopic !== null;

  return (
    <div className="space-y-2">
      <div
        className="relative rounded-lg border border-zinc-200 dark:border-zinc-800"
        style={{ height: 520 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          fitView
          fitViewOptions={{ padding: 0.4 }}
          onNodeClick={(_, node) => {
            if (node.id === OVERALL_ID) return;
            if (focusTopic && node.id === focusTopic.id) return;
            setFocusId(node.id);
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {focusTopic
            ? isLeaf
              ? "Leaf topic — no sub-topics."
              : `${children.length} sub-topic${children.length === 1 ? "" : "s"}`
            : `${children.length} root topic${children.length === 1 ? "" : "s"}`}
        </span>
        {focusId !== null && (
          <button
            type="button"
            onClick={() => setFocusId(null)}
            className="font-medium underline"
          >
            Back to overall
          </button>
        )}
      </div>
    </div>
  );
}

// Sum the question counts of all root-level topics for the synthetic
// "Overall" focus. countsByTopic already includes descendants for each
// branch, so summing the roots gives the user-wide totals.
function aggregateCounts(
  tree: TopicTreeNode[],
  countsByTopic: Map<string, { flashcards: number; shortAnswers: number }>,
): { flashcards: number; shortAnswers: number } {
  let f = 0;
  let s = 0;
  for (const root of tree) {
    const c = countsByTopic.get(root.id);
    if (c) {
      f += c.flashcards;
      s += c.shortAnswers;
    }
  }
  return { flashcards: f, shortAnswers: s };
}
