-- Add daily study quota to profiles.
-- Default 10. Range bounds keep the algorithm and UI in sane territory.

alter table public.profiles
  add column daily_quota int not null default 10
    check (daily_quota between 1 and 200);
