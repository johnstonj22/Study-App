-- Row Level Security: each user can only access their own rows.

-- ---------------------------------------------------------------------------
-- profiles (keyed on id, not user_id)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  using (id = auth.uid());

create policy profiles_insert_own
  on public.profiles for insert
  with check (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_delete_own
  on public.profiles for delete
  using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- topics
-- ---------------------------------------------------------------------------
alter table public.topics enable row level security;

create policy topics_select_own
  on public.topics for select
  using (user_id = auth.uid());

create policy topics_insert_own
  on public.topics for insert
  with check (user_id = auth.uid());

create policy topics_update_own
  on public.topics for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy topics_delete_own
  on public.topics for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- flashcards
-- ---------------------------------------------------------------------------
alter table public.flashcards enable row level security;

create policy flashcards_select_own
  on public.flashcards for select
  using (user_id = auth.uid());

create policy flashcards_insert_own
  on public.flashcards for insert
  with check (user_id = auth.uid());

create policy flashcards_update_own
  on public.flashcards for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy flashcards_delete_own
  on public.flashcards for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- short_answer_questions
-- ---------------------------------------------------------------------------
alter table public.short_answer_questions enable row level security;

create policy short_answer_questions_select_own
  on public.short_answer_questions for select
  using (user_id = auth.uid());

create policy short_answer_questions_insert_own
  on public.short_answer_questions for insert
  with check (user_id = auth.uid());

create policy short_answer_questions_update_own
  on public.short_answer_questions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy short_answer_questions_delete_own
  on public.short_answer_questions for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- review_history
-- ---------------------------------------------------------------------------
alter table public.review_history enable row level security;

create policy review_history_select_own
  on public.review_history for select
  using (user_id = auth.uid());

create policy review_history_insert_own
  on public.review_history for insert
  with check (user_id = auth.uid());

-- review_history rows are immutable for users; no update/delete policies.
