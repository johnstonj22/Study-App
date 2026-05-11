-- Weekly study schedule: per-day-of-week quota overrides + always-skip days.
-- Lets the user say "I never study Sundays, and only do 5/day on Saturdays".
-- The calendar layers these defaults onto the existing per-date `skip_dates`
-- and `daily_quota`.
--
-- weekly_skip_days: int array of dow (0=Sun .. 6=Sat) the user always skips.
-- weekly_quotas: jsonb sparse map { "<dow>": <quota> }; missing keys fall
--   back to profiles.daily_quota. Stored sparse so reverting a day to the
--   default just removes the key.

alter table public.profiles
  add column weekly_skip_days int[] not null default '{}',
  add column weekly_quotas jsonb not null default '{}'::jsonb,
  -- `<@` is "every element on the left appears in the right" — bounds dow
  -- to [0..6] without needing a subquery (which CHECK constraints forbid).
  add constraint profiles_weekly_skip_days_dow_chk
    check (weekly_skip_days <@ array[0,1,2,3,4,5,6]);
