-- Daily Guess: reusable challenge archive + automatic daily random selection.
-- Run this ONCE in Supabase SQL Editor after the existing 4-challenge migration.

alter table public.challenges alter column challenge_date drop not null;
alter table public.challenges alter column challenge_number drop not null;

-- Convert existing date-specific challenges into reusable archive entries.
update public.challenges set challenge_date = null, challenge_number = null where challenge_date is not null or challenge_number is not null;

create table if not exists public.daily_challenges (
  challenge_date date not null,
  slot smallint not null check (slot between 1 and 4),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (challenge_date, slot),
  unique (challenge_date, challenge_id)
);

create index if not exists daily_challenges_date_idx on public.daily_challenges(challenge_date);

alter table public.daily_challenges enable row level security;

create policy "daily challenge assignments readable" on public.daily_challenges
  for select using (true);

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
  -- Prevent two visitors arriving at midnight from creating different daily sets.
  perform pg_advisory_xact_lock(hashtext('daily-guess:' || p_date::text));

  select count(*) into existing_count
  from public.daily_challenges
  where challenge_date = p_date;

  if existing_count < 4 then
    select count(*) into available_count
    from public.challenges c
    where c.is_published = true
      and not exists (
        select 1 from public.daily_challenges d
        where d.challenge_date = p_date and d.challenge_id = c.id
      );

    if existing_count + available_count < 4 then
      raise exception 'Not enough published challenges in the archive. At least 4 are required.';
    end if;

    insert into public.daily_challenges(challenge_date, slot, challenge_id)
    select p_date, gs.slot, picks.id
    from generate_series(existing_count + 1, 4) as gs(slot)
    join lateral (
      select c.id
      from public.challenges c
      where c.is_published = true
        and not exists (
          select 1 from public.daily_challenges d
          where d.challenge_date = p_date and d.challenge_id = c.id
        )
      order by random()
      limit 1
    ) picks on true;
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
