-- Fix Daily Guess daily draw generation.
-- Run once in Supabase SQL Editor.
-- This replaces the buggy slot-by-slot random selection with one distinct
-- four-row selection, so midnight generation cannot collide on challenge_id.

create or replace function public.get_or_create_daily_challenges(p_date date)
returns table(
  slot smallint,
  challenge_id uuid,
  title text,
  video_path text,
  poster_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count integer;
  available_count integer;
begin
  -- Ensure only one request can generate a date at a time.
  perform pg_advisory_xact_lock(hashtext('daily-guess:' || p_date::text));

  select count(*) into existing_count
  from public.daily_challenges
  where challenge_date = p_date;

  if existing_count < 4 then
    select count(*) into available_count
    from public.challenges c
    where c.is_published = true
      and not exists (
        select 1
        from public.daily_challenges d
        where d.challenge_date = p_date
          and d.challenge_id = c.id
      );

    if existing_count + available_count < 4 then
      raise exception 'Not enough published challenges in the archive. At least 4 are required.';
    end if;

    -- Pick all remaining slots in one statement from a single shuffled pool.
    -- row_number guarantees four distinct challenge IDs.
    insert into public.daily_challenges(challenge_date, slot, challenge_id)
    select
      p_date,
      row_number() over (order by random())::smallint + existing_count,
      c.id
    from public.challenges c
    where c.is_published = true
      and not exists (
        select 1
        from public.daily_challenges d
        where d.challenge_date = p_date
          and d.challenge_id = c.id
      )
    order by random()
    limit (4 - existing_count);
  end if;

  return query
  select d.slot, c.id, c.title, c.video_path, c.poster_path
  from public.daily_challenges d
  join public.challenges c on c.id = d.challenge_id
  where d.challenge_date = p_date
  order by d.slot;
end;
$$;

revoke all on function public.get_or_create_daily_challenges(date) from public;
grant execute on function public.get_or_create_daily_challenges(date) to anon, authenticated;
