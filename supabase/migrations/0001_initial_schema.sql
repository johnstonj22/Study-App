-- Study-App initial schema
-- Tables: profiles, topics, flashcards, short_answer_questions, review_history

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  timezone      text not null default 'UTC',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- topics
-- ---------------------------------------------------------------------------
create table public.topics (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  description    text,
  category       text,
  mastery_score  numeric not null default 0 check (mastery_score between 0 and 100),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index topics_user_updated_at_idx
  on public.topics (user_id, updated_at desc);

create trigger topics_set_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- flashcards
-- ---------------------------------------------------------------------------
create table public.flashcards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  topic_id          uuid not null references public.topics(id) on delete cascade,
  front             text not null,
  back              text not null,
  difficulty        text not null default 'normal',
  mastery_score     numeric not null default 0 check (mastery_score between 0 and 100),
  ease_factor       numeric not null default 2.5 check (ease_factor >= 1.3),
  interval_days     numeric not null default 0  check (interval_days >= 0),
  repetitions       integer not null default 0  check (repetitions >= 0),
  last_reviewed_at  timestamptz,
  next_review_at    timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index flashcards_user_next_review_idx
  on public.flashcards (user_id, next_review_at);

create index flashcards_topic_idx
  on public.flashcards (topic_id);

create trigger flashcards_set_updated_at
  before update on public.flashcards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- short_answer_questions
-- ---------------------------------------------------------------------------
create table public.short_answer_questions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  topic_id          uuid not null references public.topics(id) on delete cascade,
  prompt            text not null,
  expected_answer   text,
  mastery_score     numeric not null default 0 check (mastery_score between 0 and 100),
  ease_factor       numeric not null default 2.5 check (ease_factor >= 1.3),
  interval_days     numeric not null default 0  check (interval_days >= 0),
  repetitions       integer not null default 0  check (repetitions >= 0),
  last_reviewed_at  timestamptz,
  next_review_at    timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index short_answer_questions_user_next_review_idx
  on public.short_answer_questions (user_id, next_review_at);

create index short_answer_questions_topic_idx
  on public.short_answer_questions (topic_id);

create trigger short_answer_questions_set_updated_at
  before update on public.short_answer_questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- review_history
-- ---------------------------------------------------------------------------
create table public.review_history (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  topic_id                 uuid references public.topics(id) on delete set null,
  flashcard_id             uuid references public.flashcards(id) on delete cascade,
  short_answer_id          uuid references public.short_answer_questions(id) on delete cascade,
  rating                   text not null check (rating in ('again','hard','good','easy')),
  previous_mastery_score   numeric,
  new_mastery_score        numeric,
  previous_interval_days   numeric,
  new_interval_days        numeric,
  reviewed_at              timestamptz not null default now(),
  -- exactly one item reference must be set
  constraint review_history_exactly_one_item_chk
    check ((flashcard_id is not null)::int + (short_answer_id is not null)::int = 1)
);

create index review_history_user_reviewed_at_idx
  on public.review_history (user_id, reviewed_at desc);
