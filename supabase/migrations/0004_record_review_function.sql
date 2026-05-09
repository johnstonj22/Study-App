-- record_review: atomically update an item's mastery + schedule and insert
-- a review_history row. Runs as the calling user (security invoker), so RLS
-- still applies — the function cannot be used to write rows on someone else's
-- behalf.
--
-- Scheduler logic stays in TypeScript; this function takes the precomputed
-- new mastery score and next_review_at as parameters. Its job is solely to
-- read the previous state, write the new state, and snapshot history in one
-- transaction.

create or replace function public.record_review(
  p_item_type           text,
  p_item_id             uuid,
  p_rating              text,
  p_new_mastery_score   numeric,
  p_next_review_at      timestamptz,
  p_now                 timestamptz
) returns void
language plpgsql
security invoker
as $$
declare
  v_user_id              uuid;
  v_topic_id             uuid;
  v_previous_mastery     numeric;
  v_previous_interval    numeric;
begin
  if p_rating not in ('again', 'hard', 'good', 'easy') then
    raise exception 'Invalid rating: %', p_rating;
  end if;

  if p_item_type = 'flashcard' then
    select user_id, topic_id, mastery_score, interval_days
      into v_user_id, v_topic_id, v_previous_mastery, v_previous_interval
      from public.flashcards
      where id = p_item_id
      for update;

    if not found then
      raise exception 'Flashcard not found';
    end if;

    update public.flashcards
       set mastery_score    = p_new_mastery_score,
           last_reviewed_at = p_now,
           next_review_at   = p_next_review_at
     where id = p_item_id;

    insert into public.review_history (
      user_id, topic_id, flashcard_id, rating,
      previous_mastery_score, new_mastery_score,
      previous_interval_days, new_interval_days,
      reviewed_at
    ) values (
      v_user_id, v_topic_id, p_item_id, p_rating,
      v_previous_mastery, p_new_mastery_score,
      v_previous_interval, v_previous_interval,  -- placeholder scheduler doesn't change interval_days
      p_now
    );

  elsif p_item_type = 'short_answer' then
    select user_id, topic_id, mastery_score, interval_days
      into v_user_id, v_topic_id, v_previous_mastery, v_previous_interval
      from public.short_answer_questions
      where id = p_item_id
      for update;

    if not found then
      raise exception 'Question not found';
    end if;

    update public.short_answer_questions
       set mastery_score    = p_new_mastery_score,
           last_reviewed_at = p_now,
           next_review_at   = p_next_review_at
     where id = p_item_id;

    insert into public.review_history (
      user_id, topic_id, short_answer_id, rating,
      previous_mastery_score, new_mastery_score,
      previous_interval_days, new_interval_days,
      reviewed_at
    ) values (
      v_user_id, v_topic_id, p_item_id, p_rating,
      v_previous_mastery, p_new_mastery_score,
      v_previous_interval, v_previous_interval,
      p_now
    );

  else
    raise exception 'Invalid item type: %', p_item_type;
  end if;
end;
$$;
