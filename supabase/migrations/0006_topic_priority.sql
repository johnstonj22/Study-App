-- Per-topic priority for the daily distribution algorithm.
-- Lower number = higher priority. Topic items at priority N are scheduled
-- (and shown in the queue) before items at priority N+1. Within a tier,
-- topics share evenly. Default 5 leaves headroom in both directions.

alter table public.topics
  add column priority int not null default 5
    check (priority between 1 and 99);
