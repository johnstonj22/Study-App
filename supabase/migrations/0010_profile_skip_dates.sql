-- Skip days: dates the user does not want to study. Stored as a JSONB array
-- of YYYY-MM-DD strings on the profile. Small (typically <= 365 entries),
-- user-scoped, written rarely — no need for a separate table.
--
-- The two helper functions perform read-modify-write atomically inside
-- Postgres, avoiding races when the user toggles dates quickly. Both run as
-- security invoker so RLS still scopes the update to auth.uid()'s own row.

alter table public.profiles
  add column skip_dates jsonb not null default '[]'::jsonb;

-- Adds `p_date` to the caller's skip_dates if not already present.
create or replace function public.add_skip_date(p_date text)
returns void
language plpgsql
security invoker
as $$
begin
  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Invalid date format (expected YYYY-MM-DD): %', p_date;
  end if;

  update public.profiles
     set skip_dates =
       case
         when skip_dates @> to_jsonb(p_date) then skip_dates
         else skip_dates || to_jsonb(p_date)
       end
   where id = auth.uid();
end;
$$;

-- Removes `p_date` from the caller's skip_dates (no-op if absent).
create or replace function public.remove_skip_date(p_date text)
returns void
language plpgsql
security invoker
as $$
begin
  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Invalid date format (expected YYYY-MM-DD): %', p_date;
  end if;

  update public.profiles
     set skip_dates = (
       select coalesce(jsonb_agg(elem), '[]'::jsonb)
         from jsonb_array_elements_text(skip_dates) as elem
        where elem <> p_date
     )
   where id = auth.uid();
end;
$$;
