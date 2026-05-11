-- Sub-topics: a topic can be the parent of other topics, forming a tree.
-- parent_id = null means a root topic. Strict tree semantics (a topic with
-- children must not also own questions, and vice versa) are enforced in the
-- service layer, not the schema, since SQL recursive checks are awkward.
--
-- on delete cascade so deleting a parent removes all descendants and (via
-- existing FKs) their flashcards / short-answer questions.

alter table public.topics
  add column parent_id uuid references public.topics(id) on delete cascade;

create index topics_user_parent_idx on public.topics (user_id, parent_id);

-- Self-parent guard. Deeper cycles (A -> B -> A) are blocked in services.
alter table public.topics
  add constraint topics_no_self_parent
  check (parent_id is null or parent_id <> id);
