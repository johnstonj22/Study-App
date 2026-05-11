// Topics service. PURE: takes a SupabaseClient, no Next/React imports.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Topic,
  TopicInsert,
  TopicTreeNode,
  TopicUpdate,
} from "../types/domain";

// --- Validation schemas --------------------------------------------------

export const TopicCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
});

export type TopicCreateInput = z.infer<typeof TopicCreateSchema>;

export const TopicUpdateSchema = TopicCreateSchema.partial();
export type TopicUpdateInput = z.infer<typeof TopicUpdateSchema>;

export const TopicPriorityUpdateSchema = z.object({
  id: z.string().uuid(),
  priority: z
    .number()
    .int("Priority must be a whole number")
    .min(1, "Priority must be at least 1")
    .max(99, "Priority cannot exceed 99"),
});
export type TopicPriorityUpdateInput = z.infer<typeof TopicPriorityUpdateSchema>;

export const SubTopicSplitSpecSchema = z.object({
  title: z.string().trim().min(1, "Sub-topic title is required").max(200),
  flashcard_ids: z.array(z.string().uuid()).default([]),
  short_answer_ids: z.array(z.string().uuid()).default([]),
});
export type SubTopicSplitSpec = z.infer<typeof SubTopicSplitSpecSchema>;

// --- Service functions ---------------------------------------------------

type Client = SupabaseClient<Database>;

export async function listTopics(client: Client): Promise<Topic[]> {
  const { data, error } = await client
    .from("topics")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Topic[];
}

export async function getTopic(
  client: Client,
  id: string,
): Promise<Topic | null> {
  const { data, error } = await client
    .from("topics")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Topic | null) ?? null;
}

export async function createTopic(
  client: Client,
  userId: string,
  input: TopicCreateInput,
): Promise<Topic> {
  if (input.parent_id) {
    await assertCanAddChildTopic(client, input.parent_id);
  }

  const insert: TopicInsert = {
    user_id: userId,
    title: input.title,
    description: input.description ?? null,
    category: input.category ?? null,
    parent_id: input.parent_id ?? null,
  };
  // Cast: parent_id is added by migration 0008; the generated Database type
  // is updated by `npx supabase gen types`. Until then we bypass the strict
  // excess-property check on the typed builder.
  const { data, error } = await client
    .from("topics")
    .insert(insert as never)
    .select()
    .single();
  if (error) throw error;
  return data as Topic;
}

export async function updateTopic(
  client: Client,
  id: string,
  input: TopicUpdateInput,
): Promise<Topic> {
  if (input.parent_id !== undefined && input.parent_id !== null) {
    await assertNoCycle(client, id, input.parent_id);
    await assertCanAddChildTopic(client, input.parent_id);
  }

  const update: TopicUpdate = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description;
  if (input.category !== undefined) update.category = input.category;
  if (input.parent_id !== undefined) update.parent_id = input.parent_id;

  // Cast: see note in createTopic. Remove after running gen-types.
  const { data, error } = await client
    .from("topics")
    .update(update as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Topic;
}

export async function deleteTopic(client: Client, id: string): Promise<void> {
  const { error } = await client.from("topics").delete().eq("id", id);
  if (error) throw error;
}

export async function getRecentTopics(
  client: Client,
  limit: number,
): Promise<Topic[]> {
  const { data, error } = await client
    .from("topics")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Topic[];
}

// Returns the `limit` topics with the lowest computed mastery, but excludes
// topics whose subtree has no items (those are 0 by default and would just
// add noise — they're "unstarted", not "weak"). Each result carries its
// computed mastery for display.
export async function getWeakestTopics(
  client: Client,
  limit: number,
): Promise<Array<Topic & { computed_mastery: number }>> {
  const [topics, mastery] = await Promise.all([
    listTopics(client),
    computeTopicMasteryTree(client),
  ]);

  // A topic counts as "having data" if any descendant item exists. We can
  // detect that by checking the mastery map: a fully-empty subtree is 0,
  // but so is a subtree where everything happens to be at 0%. To distinguish,
  // re-load item topic_ids cheaply.
  const { data: fcIds } = (await client
    .from("flashcards")
    .select("topic_id")) as { data: Array<{ topic_id: string }> | null };
  const { data: saIds } = (await client
    .from("short_answer_questions")
    .select("topic_id")) as { data: Array<{ topic_id: string }> | null };

  const leavesWithData = new Set<string>();
  for (const r of fcIds ?? []) leavesWithData.add(r.topic_id);
  for (const r of saIds ?? []) leavesWithData.add(r.topic_id);

  // Walk up from each data-bearing leaf; mark every ancestor as having data.
  const parentById = new Map<string, string | null>();
  for (const t of topics) parentById.set(t.id, t.parent_id);
  const topicsWithData = new Set<string>();
  for (const leaf of leavesWithData) {
    let cursor: string | null | undefined = leaf;
    while (cursor && !topicsWithData.has(cursor)) {
      topicsWithData.add(cursor);
      cursor = parentById.get(cursor) ?? null;
    }
  }

  return topics
    .filter((t) => topicsWithData.has(t.id))
    .map((t) => ({ ...t, computed_mastery: mastery.map.get(t.id) ?? 0 }))
    .sort((a, b) => a.computed_mastery - b.computed_mastery)
    .slice(0, limit);
}

// Map of topic_id → priority for the current user. Used by the distribution
// algorithm and the bonus ordering. Cheap (one indexed scan, ~rows-per-user).
export async function getTopicPriorities(
  client: Client,
): Promise<Map<string, number>> {
  const { data, error } = await client.from("topics").select("id, priority");
  if (error) throw error;
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.id, row.priority);
  }
  return map;
}

// Apply a batch of priority updates in parallel. Each call is a single
// row update scoped by RLS.
export async function updateTopicPriorities(
  client: Client,
  inputs: TopicPriorityUpdateInput[],
): Promise<void> {
  await Promise.all(
    inputs.map(async ({ id, priority }) => {
      const { error } = await client
        .from("topics")
        .update({ priority })
        .eq("id", id);
      if (error) throw error;
    }),
  );
}

// --- Tree helpers --------------------------------------------------------

export async function getChildTopics(
  client: Client,
  parentId: string | null,
): Promise<Topic[]> {
  // Casts: parent_id column is added by migration 0008. Generated types
  // catch up after `npx supabase gen types` is re-run.
  const base = client
    .from("topics")
    .select("*")
    .order("title", { ascending: true });
  const filtered =
    parentId === null
      ? (base.is as (col: string, v: null) => typeof base)("parent_id", null)
      : (base.eq as (col: string, v: string) => typeof base)(
          "parent_id",
          parentId,
        );
  const { data, error } = await filtered;
  if (error) throw error;
  return (data ?? []) as Topic[];
}

// Returns the entire topic forest (root-level nodes with their nested
// descendants). Single query; tree is built in memory. Stable ordering by
// title at each level.
export async function getTopicTree(client: Client): Promise<TopicTreeNode[]> {
  const topics = await listTopics(client);
  return buildTopicTree(topics);
}

// All topics that are leaves (have no child topics) and so are eligible to
// receive questions. Used by the "Move questions" picker. `excludeId` keeps
// the source topic out of the target list.
export async function getLeafTopics(
  client: Client,
  excludeId?: string,
): Promise<Topic[]> {
  const topics = await listTopics(client);
  const hasChild = new Set<string>();
  for (const t of topics) {
    if (t.parent_id) hasChild.add(t.parent_id);
  }
  return topics.filter(
    (t) => !hasChild.has(t.id) && t.id !== excludeId,
  );
}

export async function topicHasChildren(
  client: Client,
  topicId: string,
): Promise<boolean> {
  const base = client
    .from("topics")
    .select("id", { count: "exact", head: true });
  const { count, error } = await (
    base.eq as (col: string, v: string) => typeof base
  )("parent_id", topicId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function topicHasQuestions(
  client: Client,
  topicId: string,
): Promise<boolean> {
  const [fc, sa] = await Promise.all([
    client
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topicId),
    client
      .from("short_answer_questions")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topicId),
  ]);
  if (fc.error) throw fc.error;
  if (sa.error) throw sa.error;
  return (fc.count ?? 0) > 0 || (sa.count ?? 0) > 0;
}

// Throws if the parent topic still has direct flashcards or short-answer
// questions. The caller (UI) should route the user through the split flow
// first to redistribute those questions.
export async function assertCanAddChildTopic(
  client: Client,
  parentId: string,
): Promise<void> {
  if (await topicHasQuestions(client, parentId)) {
    throw new Error(
      "This topic has questions. Convert it to a branch by splitting its questions into sub-topics first.",
    );
  }
}

// Throws if the topic already has child topics (i.e. is a branch). Branch
// topics may not directly own questions.
export async function assertCanAddQuestion(
  client: Client,
  topicId: string,
): Promise<void> {
  if (await topicHasChildren(client, topicId)) {
    throw new Error(
      "This topic has sub-topics. Add the question to one of its sub-topics instead.",
    );
  }
}

// Walks the proposed parent's ancestor chain. Throws if `topicId` appears
// anywhere in it (which would create a cycle). Also rejects setting a topic
// as its own parent (the schema CHECK catches this too, but we want a nicer
// error message).
export async function assertNoCycle(
  client: Client,
  topicId: string,
  newParentId: string,
): Promise<void> {
  if (topicId === newParentId) {
    throw new Error("A topic cannot be its own parent.");
  }
  // Load all of the user's topics once and walk in memory — RLS keeps this
  // bounded to the user's own tree, which is small.
  const result = (await client.from("topics").select("id, parent_id")) as {
    data: Array<{ id: string; parent_id: string | null }> | null;
    error: Error | null;
  };
  if (result.error) throw result.error;

  const parentMap = new Map<string, string | null>();
  for (const row of result.data ?? []) {
    parentMap.set(row.id, row.parent_id);
  }

  if (wouldCreateCycle(topicId, newParentId, parentMap)) {
    throw new Error("That parent would create a cycle.");
  }
}

// Move a set of flashcards / short-answer questions from one leaf topic to
// another. The target must be a leaf (no children). Updates are scoped by
// (id IN (...) AND topic_id = source) so a stale id can't pull a question
// out of an unrelated topic. Two statements (one per item table); not strictly
// atomic across both, but each statement is itself transactional.
export async function moveQuestions(
  client: Client,
  sourceTopicId: string,
  targetTopicId: string,
  flashcardIds: string[],
  shortAnswerIds: string[],
): Promise<void> {
  if (sourceTopicId === targetTopicId) {
    throw new Error("Source and target topic are the same.");
  }
  if (flashcardIds.length === 0 && shortAnswerIds.length === 0) {
    throw new Error("Select at least one question to move.");
  }
  await assertCanAddQuestion(client, targetTopicId);

  if (flashcardIds.length > 0) {
    const { error } = await client
      .from("flashcards")
      .update({ topic_id: targetTopicId })
      .in("id", flashcardIds)
      .eq("topic_id", sourceTopicId);
    if (error) throw error;
  }

  if (shortAnswerIds.length > 0) {
    const { error } = await client
      .from("short_answer_questions")
      .update({ topic_id: targetTopicId })
      .in("id", shortAnswerIds)
      .eq("topic_id", sourceTopicId);
    if (error) throw error;
  }
}

// Calls the convert_leaf_to_branch Postgres function. Atomic on the server.
export async function convertLeafToBranch(
  client: Client,
  parentTopicId: string,
  specs: SubTopicSplitSpec[],
): Promise<string[]> {
  if (specs.length < 1) {
    throw new Error("At least one sub-topic is required.");
  }
  // RPC is added by migration 0009; cast through unknown until types regen.
  const { data, error } = await (
    client.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: string[] | null; error: Error | null }>
  )("convert_leaf_to_branch", {
    p_parent_id: parentTopicId,
    p_specs: specs.map((s) => ({
      title: s.title,
      flashcard_ids: s.flashcard_ids,
      short_answer_ids: s.short_answer_ids,
    })),
  });
  if (error) throw error;
  return data ?? [];
}

// --- Pure helpers (testable without DB) ----------------------------------

// Build a forest of TopicTreeNodes from a flat row list. Children are sorted
// by title. Orphans (parent_id pointing to a missing row) are surfaced as
// roots so they aren't silently dropped.
export function buildTopicTree(topics: Topic[]): TopicTreeNode[] {
  const nodes = new Map<string, TopicTreeNode>();
  for (const t of topics) {
    nodes.set(t.id, { ...t, children: [] });
  }

  const roots: TopicTreeNode[] = [];
  for (const node of nodes.values()) {
    const parentId = node.parent_id;
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const byTitle = (a: TopicTreeNode, b: TopicTreeNode) =>
    a.title.localeCompare(b.title);
  const sortRec = (list: TopicTreeNode[]) => {
    list.sort(byTitle);
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

// True if making `topicId` a child of `newParentId` would create a cycle.
// Walks ancestors of newParentId; if topicId appears, it's a cycle.
export function wouldCreateCycle(
  topicId: string,
  newParentId: string,
  parentMap: Map<string, string | null>,
): boolean {
  let cursor: string | null | undefined = newParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === topicId) return true;
    if (seen.has(cursor)) return true; // defensive: pre-existing cycle
    seen.add(cursor);
    cursor = parentMap.get(cursor) ?? null;
  }
  return false;
}

// Compute mastery for every topic in the user's tree by averaging immediate
// children. For a leaf topic (no child topics), mastery = avg of its
// flashcard + short-answer mastery_scores. For a branch topic (has child
// topics), mastery = avg of children's computed mastery. Empty topic = 0.
// Also returns `overall` = avg of root-level topics' mastery.
//
// Three queries (topics, flashcards, short-answers); recursion happens in
// memory. The user's tree is small enough that this is cheap; we do it on
// every dashboard / topic-list render so the UI is always fresh.
export async function computeTopicMasteryTree(client: Client): Promise<{
  map: Map<string, number>;
  overall: number;
}> {
  const [topicsRes, fcRes, saRes] = await Promise.all([
    (async () => {
      const r = (await client.from("topics").select("id, parent_id")) as {
        data: Array<{ id: string; parent_id: string | null }> | null;
        error: Error | null;
      };
      if (r.error) throw r.error;
      return r.data ?? [];
    })(),
    (async () => {
      const r = await client
        .from("flashcards")
        .select("topic_id, mastery_score");
      if (r.error) throw r.error;
      return (r.data ?? []) as Array<{
        topic_id: string;
        mastery_score: number;
      }>;
    })(),
    (async () => {
      const r = await client
        .from("short_answer_questions")
        .select("topic_id, mastery_score");
      if (r.error) throw r.error;
      return (r.data ?? []) as Array<{
        topic_id: string;
        mastery_score: number;
      }>;
    })(),
  ]);

  return computeMasteryFromRows(topicsRes, [
    ...fcRes,
    ...saRes,
  ]);
}

// Per-topic counts of flashcards and short-answer questions, **aggregated up
// the tree** so a branch topic shows the total count from all descendants.
// Used by the dashboard map node to display "12 Q · F: 8 · S: 4".
export async function getQuestionCountsByTopic(client: Client): Promise<
  Map<string, { flashcards: number; shortAnswers: number }>
> {
  const [topicsRes, fcRes, saRes] = await Promise.all([
    (async () => {
      const r = (await client.from("topics").select("id, parent_id")) as {
        data: Array<{ id: string; parent_id: string | null }> | null;
        error: Error | null;
      };
      if (r.error) throw r.error;
      return r.data ?? [];
    })(),
    (async () => {
      const r = await client.from("flashcards").select("topic_id");
      if (r.error) throw r.error;
      return (r.data ?? []) as Array<{ topic_id: string }>;
    })(),
    (async () => {
      const r = await client.from("short_answer_questions").select("topic_id");
      if (r.error) throw r.error;
      return (r.data ?? []) as Array<{ topic_id: string }>;
    })(),
  ]);

  return aggregateQuestionCounts(topicsRes, fcRes, saRes);
}

// Pure helper. Sums each topic's own items plus all descendants'.
export function aggregateQuestionCounts(
  topics: Array<{ id: string; parent_id: string | null }>,
  flashcards: Array<{ topic_id: string }>,
  shortAnswers: Array<{ topic_id: string }>,
): Map<string, { flashcards: number; shortAnswers: number }> {
  const directFc = new Map<string, number>();
  const directSa = new Map<string, number>();
  for (const r of flashcards) {
    directFc.set(r.topic_id, (directFc.get(r.topic_id) ?? 0) + 1);
  }
  for (const r of shortAnswers) {
    directSa.set(r.topic_id, (directSa.get(r.topic_id) ?? 0) + 1);
  }

  const childrenByParent = new Map<string | null, string[]>();
  for (const t of topics) {
    const arr = childrenByParent.get(t.parent_id) ?? [];
    arr.push(t.id);
    childrenByParent.set(t.parent_id, arr);
  }

  const result = new Map<string, { flashcards: number; shortAnswers: number }>();
  const visit = (id: string): { flashcards: number; shortAnswers: number } => {
    const cached = result.get(id);
    if (cached) return cached;
    let fc = directFc.get(id) ?? 0;
    let sa = directSa.get(id) ?? 0;
    for (const child of childrenByParent.get(id) ?? []) {
      const sub = visit(child);
      fc += sub.flashcards;
      sa += sub.shortAnswers;
    }
    const sum = { flashcards: fc, shortAnswers: sa };
    result.set(id, sum);
    return sum;
  };
  for (const t of topics) visit(t.id);
  return result;
}

// Pure helper extracted so the recursion can be tested without a database.
// `topics` only needs id + parent_id; `items` needs topic_id + mastery_score.
export function computeMasteryFromRows(
  topics: Array<{ id: string; parent_id: string | null }>,
  items: Array<{ topic_id: string; mastery_score: number | string }>,
): { map: Map<string, number>; overall: number } {
  const childTopicsByParent = new Map<string | null, string[]>();
  for (const t of topics) {
    const arr = childTopicsByParent.get(t.parent_id) ?? [];
    arr.push(t.id);
    childTopicsByParent.set(t.parent_id, arr);
  }

  const itemMasteryByTopic = new Map<string, number[]>();
  for (const it of items) {
    const arr = itemMasteryByTopic.get(it.topic_id) ?? [];
    arr.push(Number(it.mastery_score));
    itemMasteryByTopic.set(it.topic_id, arr);
  }

  const result = new Map<string, number>();
  // DFS computing each topic once. Strict tree means a topic has either
  // children topics OR items; if it has children, item lists for that topic
  // shouldn't exist (and are ignored if they do).
  const visit = (id: string): number => {
    const cached = result.get(id);
    if (cached !== undefined) return cached;
    const childIds = childTopicsByParent.get(id);
    let mastery = 0;
    if (childIds && childIds.length > 0) {
      let sum = 0;
      for (const c of childIds) sum += visit(c);
      mastery = sum / childIds.length;
    } else {
      const items = itemMasteryByTopic.get(id);
      if (items && items.length > 0) {
        let sum = 0;
        for (const m of items) sum += m;
        mastery = sum / items.length;
      }
    }
    result.set(id, mastery);
    return mastery;
  };
  for (const t of topics) visit(t.id);

  const roots = childTopicsByParent.get(null) ?? [];
  let overall = 0;
  if (roots.length > 0) {
    let sum = 0;
    for (const r of roots) sum += result.get(r) ?? 0;
    overall = sum / roots.length;
  }

  return { map: result, overall };
}

// Walk from a topic up to the root, returning the chain of ancestor topics
// (root-first). Used for breadcrumbs. Pure.
export function getAncestorChain(
  topicId: string,
  topicsById: Map<string, Topic>,
): Topic[] {
  const chain: Topic[] = [];
  let cursor: string | null | undefined = topicId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const t = topicsById.get(cursor);
    if (!t) break;
    chain.unshift(t);
    cursor = t.parent_id;
  }
  return chain;
}
