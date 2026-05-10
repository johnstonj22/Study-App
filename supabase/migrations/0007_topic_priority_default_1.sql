-- Reset the default priority for new topics from 5 to 1, so a freshly created
-- topic is "highest priority" by default. Existing rows are left alone — only
-- the column default for future inserts changes.

alter table public.topics
  alter column priority set default 1;
