import { describe, it, expect } from "vitest";
import {
  buildTopicTree,
  getAncestorChain,
  wouldCreateCycle,
} from "../lib/services/topics";
import type { Topic } from "../lib/types/domain";

// Minimal Topic factory — only the columns the tree helpers actually read.
function topic(
  id: string,
  parent_id: string | null,
  title = id,
): Topic {
  return {
    id,
    parent_id,
    title,
    user_id: "u",
    description: null,
    category: null,
    mastery_score: 0,
    priority: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as unknown as Topic;
}

describe("buildTopicTree", () => {
  it("returns roots with their nested children", () => {
    const tree = buildTopicTree([
      topic("a", null, "A"),
      topic("a1", "a", "A1"),
      topic("a2", "a", "A2"),
      topic("a1a", "a1", "A1a"),
      topic("b", null, "B"),
    ]);
    expect(tree.map((n) => n.id)).toEqual(["a", "b"]);
    const a = tree[0]!;
    expect(a.children.map((n) => n.id)).toEqual(["a1", "a2"]);
    expect(a.children[0]!.children.map((n) => n.id)).toEqual(["a1a"]);
  });

  it("sorts each level alphabetically by title", () => {
    const tree = buildTopicTree([
      topic("z", null, "Zeta"),
      topic("a", null, "Alpha"),
      topic("m", null, "Mu"),
    ]);
    expect(tree.map((n) => n.title)).toEqual(["Alpha", "Mu", "Zeta"]);
  });

  it("surfaces orphans (missing parent) as roots so they aren't lost", () => {
    const tree = buildTopicTree([
      topic("a", null, "A"),
      topic("orphan", "missing-parent", "Orphan"),
    ]);
    expect(tree.map((n) => n.id).sort()).toEqual(["a", "orphan"]);
  });

  it("returns an empty forest for no input", () => {
    expect(buildTopicTree([])).toEqual([]);
  });
});

describe("wouldCreateCycle", () => {
  // a -> b -> c (a is root)
  const parents = new Map<string, string | null>([
    ["a", null],
    ["b", "a"],
    ["c", "b"],
  ]);

  it("rejects making an ancestor a child of its descendant", () => {
    // moving 'a' under 'c' would create a cycle (a's new parent c → b → a)
    expect(wouldCreateCycle("a", "c", parents)).toBe(true);
  });

  it("allows attaching to a sibling subtree", () => {
    const m = new Map<string, string | null>(parents);
    m.set("d", "a"); // sibling of b
    // moving 'b' under 'd' — d's chain is d → a, doesn't include b
    expect(wouldCreateCycle("b", "d", m)).toBe(false);
  });

  it("allows attaching to a root with no relation", () => {
    const m = new Map<string, string | null>(parents);
    m.set("x", null);
    expect(wouldCreateCycle("c", "x", m)).toBe(false);
  });

  it("rejects self-parent", () => {
    expect(wouldCreateCycle("b", "b", parents)).toBe(true);
  });

  it("terminates on a pre-existing cycle in the data", () => {
    // x -> y -> x (corrupt). Asking about an unrelated topic shouldn't loop.
    const m = new Map<string, string | null>([
      ["x", "y"],
      ["y", "x"],
    ]);
    expect(wouldCreateCycle("z", "x", m)).toBe(true);
  });
});

describe("getAncestorChain", () => {
  const t = (id: string, parent: string | null) => topic(id, parent, id);
  const topics = new Map([
    ["root", t("root", null)],
    ["mid", t("mid", "root")],
    ["leaf", t("leaf", "mid")],
  ]);

  it("returns root-first chain including the topic itself", () => {
    const chain = getAncestorChain("leaf", topics);
    expect(chain.map((c) => c.id)).toEqual(["root", "mid", "leaf"]);
  });

  it("returns just the topic when it's already a root", () => {
    expect(getAncestorChain("root", topics).map((c) => c.id)).toEqual(["root"]);
  });

  it("returns an empty chain for unknown ids", () => {
    expect(getAncestorChain("missing", topics)).toEqual([]);
  });
});
