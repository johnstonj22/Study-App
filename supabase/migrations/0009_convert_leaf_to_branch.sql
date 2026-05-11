-- convert_leaf_to_branch: in one transaction, create N sub-topics under a
-- given parent and re-point a set of flashcards / short-answer questions onto
-- those new sub-topics. Used by the "split leaf into branches" UX.
--
-- security invoker so RLS still applies — a user can only convert their own
-- topics, and can only re-point questions they own.
--
-- p_specs is a JSON array; each element describes one new sub-topic and the
-- ids of existing items to reassign:
--
--   [
--     { "title": "...", "flashcard_ids": ["..."], "short_answer_ids": ["..."] },
--     ...
--   ]
--
-- Returns the array of newly created topic ids in input order.

create or replace function public.convert_leaf_to_branch(
  p_parent_id uuid,
  p_specs     jsonb
) returns uuid[]
language plpgsql
security invoker
as $$
declare
  v_user_id        uuid;
  v_parent_priority int;
  v_spec           jsonb;
  v_new_topic_id   uuid;
  v_new_ids        uuid[] := array[]::uuid[];
  v_fc_id          uuid;
  v_sa_id          uuid;
  v_updated        int;
begin
  if jsonb_typeof(p_specs) <> 'array' then
    raise exception 'p_specs must be a JSON array';
  end if;

  if jsonb_array_length(p_specs) < 1 then
    raise exception 'At least one sub-topic spec is required';
  end if;

  -- Look up parent and lock it. RLS limits this to the caller's own topics,
  -- so a missing row here means either it doesn't exist or it's not theirs.
  select user_id, priority
    into v_user_id, v_parent_priority
    from public.topics
    where id = p_parent_id
    for update;

  if not found then
    raise exception 'Parent topic not found';
  end if;

  for v_spec in select * from jsonb_array_elements(p_specs)
  loop
    if coalesce(trim(v_spec ->> 'title'), '') = '' then
      raise exception 'Sub-topic title is required';
    end if;

    insert into public.topics (user_id, parent_id, title, priority)
      values (v_user_id, p_parent_id, v_spec ->> 'title', v_parent_priority)
      returning id into v_new_topic_id;

    v_new_ids := v_new_ids || v_new_topic_id;

    -- Reassign flashcards. Constrained to ones currently under the parent
    -- to prevent stealing items from other topics.
    if jsonb_typeof(v_spec -> 'flashcard_ids') = 'array' then
      for v_fc_id in
        select (value #>> '{}')::uuid
          from jsonb_array_elements(v_spec -> 'flashcard_ids')
      loop
        update public.flashcards
           set topic_id = v_new_topic_id
         where id = v_fc_id
           and topic_id = p_parent_id;
        get diagnostics v_updated = row_count;
        if v_updated = 0 then
          raise exception 'Flashcard % is not under parent topic', v_fc_id;
        end if;
      end loop;
    end if;

    if jsonb_typeof(v_spec -> 'short_answer_ids') = 'array' then
      for v_sa_id in
        select (value #>> '{}')::uuid
          from jsonb_array_elements(v_spec -> 'short_answer_ids')
      loop
        update public.short_answer_questions
           set topic_id = v_new_topic_id
         where id = v_sa_id
           and topic_id = p_parent_id;
        get diagnostics v_updated = row_count;
        if v_updated = 0 then
          raise exception 'Short-answer % is not under parent topic', v_sa_id;
        end if;
      end loop;
    end if;
  end loop;

  -- Verify the parent is now empty of items. If anything was left unassigned
  -- we abort so the parent doesn't become a mixed (branch + items) topic.
  if exists (
    select 1 from public.flashcards where topic_id = p_parent_id
  ) or exists (
    select 1 from public.short_answer_questions where topic_id = p_parent_id
  ) then
    raise exception 'Parent topic still has unassigned questions';
  end if;

  return v_new_ids;
end;
$$;
