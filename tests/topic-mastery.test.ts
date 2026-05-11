import { describe, it, expect } from "vitest";
import { computeMasteryFromRows } from "../lib/services/topics";

// Sugar to keep the fixtures readable.
const t = (id: string, parent_id: string | null = null) => ({ id, parent_id });
const item = (topic_id: string, mastery_score: number) => ({
  topic_id,
  mastery_score,
});

describe("computeMasteryFromRows", () => {
  it("averages a leaf's items", () => {
    const { map, overall } = computeMasteryFromRows(
      [t("leaf")],
      [item("leaf", 40), item("leaf", 60), item("leaf", 80)],
    );
    expect(map.get("leaf")).toBe(60);
    expect(overall).toBe(60);
  });

  it("rolls a branch up as the average of its immediate children", () => {
    const { map, overall } = computeMasteryFromRows(
      [t("root"), t("a", "root"), t("b", "root")],
      [item("a", 100), item("b", 0)],
    );
    // a = 100, b = 0; root = avg(100, 0) = 50
    expect(map.get("a")).toBe(100);
    expect(map.get("b")).toBe(0);
    expect(map.get("root")).toBe(50);
    expect(overall).toBe(50);
  });

  it("does NOT weight by descendant count (immediate-children average)", () => {
    // root has two child branches; one of them has many items, the other one.
    // The immediate-children rule means each child branch counts equally.
    const { map } = computeMasteryFromRows(
      [
        t("root"),
        t("big", "root"),
        t("small", "root"),
        t("big-leaf", "big"),
        t("small-leaf", "small"),
      ],
      [
        item("big-leaf", 90),
        item("big-leaf", 90),
        item("big-leaf", 90),
        item("small-leaf", 10),
      ],
    );
    expect(map.get("big-leaf")).toBe(90);
    expect(map.get("small-leaf")).toBe(10);
    expect(map.get("big")).toBe(90); // single child of "big"
    expect(map.get("small")).toBe(10);
    // root averages immediate children only
    expect(map.get("root")).toBe(50);
  });

  it("treats an empty topic as 0", () => {
    const { map, overall } = computeMasteryFromRows(
      [t("alone")],
      [],
    );
    expect(map.get("alone")).toBe(0);
    expect(overall).toBe(0);
  });

  it("computes overall as the average of root-level topics only", () => {
    const { overall } = computeMasteryFromRows(
      [t("a"), t("b"), t("a-child", "a")],
      [item("a-child", 80), item("b", 20)],
    );
    // a = 80 (its single child), b = 20; overall = 50
    expect(overall).toBe(50);
  });

  it("handles a multi-level branch chain", () => {
    const { map } = computeMasteryFromRows(
      [
        t("root"),
        t("mid", "root"),
        t("leaf", "mid"),
      ],
      [item("leaf", 40), item("leaf", 60)],
    );
    expect(map.get("leaf")).toBe(50);
    expect(map.get("mid")).toBe(50);
    expect(map.get("root")).toBe(50);
  });

  it("returns 0 overall when there are no topics", () => {
    const { map, overall } = computeMasteryFromRows([], []);
    expect(map.size).toBe(0);
    expect(overall).toBe(0);
  });
});
