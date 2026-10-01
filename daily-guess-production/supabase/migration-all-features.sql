-- Daily Guess: engagement, profiles, stats, achievements and challenge analytics
alter table public.challenges add column if not exists difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard'));

alter table public.submissions add column if not exists answers jsonb not null default '{}'::jsonb;
alter table public.submissions add column if not exists confidence jsonb not null default '{}'::jsonb;
alter table public.submissions add column if not exists elapsed_seconds integer not null default 0 check(elapsed_seconds >= 0);

create index if not exists submissions_display_name_idx on public.submissions(lower(trim(display_name)));
create index if not exists submissions_challenge_idx on public.submissions(challenge_id);

-- Keep the existing daily-draw function, but make selection prefer challenges not used recently.
drop function if exists public.get_or_create_daily_challenges(date);
create or replace function public.get_or_create_daily_challenges(p_date date)
returns table(slot smallint, challenge_id uuid, title text, video_path text, poster_path text, difficulty text)
language plpgsql security definer set search_path = public
as $$
declare
  existing_count integer;
  available_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('daily-guess:' || p_date::text));

  select count(*) into existing_count from public.daily_challenges where challenge_date = p_date;

  if existing_count < 4 then
    select count(*) into available_count
    from public.challenges c
    where c.is_published = true
      and not exists (select 1 from public.daily_challenges d where d.challenge_date = p_date and d.challenge_id = c.id);

    if existing_count + available_count < 4 then
      raise exception 'Not enough published challenges in the archive. At least four are required.';
    end if;

    insert into public.daily_challenges(challenge_date, slot, challenge_id)
    select p_date,
           row_number() over (order by
             case when lu.last_used is null or lu.last_used < p_date - 7 then 0 else 1 end,
             lu.last_used asc nulls first,
             random()
           )::smallint + existing_count,
           c.id
    from public.challenges c
    left join lateral (
      select max(d.challenge_date) as last_used
      from public.daily_challenges d
      where d.challenge_id = c.id and d.challenge_date < p_date
    ) lu on true
    where c.is_published = true
      and not exists (select 1 from public.daily_challenges d where d.challenge_date = p_date and d.challenge_id = c.id)
    order by case when lu.last_used is null or lu.last_used < p_date - 7 then 0 else 1 end,
             lu.last_used asc nulls first, random()
    limit (4 - existing_count);
  end if;

  return query
  select d.slot, c.id, c.title, c.video_path, c.poster_path, c.difficulty
  from public.daily_challenges d
  join public.challenges c on c.id = d.challenge_id
  where d.challenge_date = p_date
  order by d.slot;
end;
$$;

revoke all on function public.get_or_create_daily_challenges(date) from public;
grant execute on function public.get_or_create_daily_challenges(date) to anon, authenticated;

-- Helpful view for admin reporting.
create or replace view public.challenge_usage_stats as
select c.id,
       coalesce(u.days_used,0)::int as days_used,
       u.last_used,
       coalesce(s.total_points,0)::int as total_points,
       coalesce(s.submissions,0)::int as submissions,
       coalesce(s.average_score,0)::numeric as average_score
from public.challenges c
left join (select challenge_id,count(distinct challenge_date)::int as days_used,max(challenge_date) as last_used from public.daily_challenges group by challenge_id) u on u.challenge_id=c.id
left join (select challenge_id,coalesce(sum(score),0)::int as total_points,count(*)::int as submissions,round(avg(score)::numeric,2) as average_score from public.submissions group by challenge_id) s on s.challenge_id=c.id;

-- Ensure the client can never query raw correct answers via normal RLS.
-- Existing public policy only exposes published challenge rows, so remove it and replace it
-- with a metadata-only RPC used by the day page.
drop policy if exists "published challenge metadata" on public.challenges;

create or replace function public.get_public_daily_challenges(p_date date)
returns table(slot smallint, challenge_id uuid, title text, poster_path text, difficulty text)
language sql security definer set search_path = public
as $$
  select d.slot, c.id, c.title, c.poster_path, c.difficulty
  from public.daily_challenges d
  join public.challenges c on c.id=d.challenge_id
  where d.challenge_date=p_date and c.is_published=true
  order by d.slot;
$$;
revoke all on function public.get_public_daily_challenges(date) from public;
grant execute on function public.get_public_daily_challenges(date) to anon, authenticated;

-- Public daily challenge history (no answers exposed).
create or replace function public.get_daily_history()
returns table(challenge_date date, total_challenges bigint)
language sql security definer set search_path = public
as $$
  select challenge_date, count(*) from public.daily_challenges group by challenge_date order by challenge_date desc limit 90;
$$;
revoke all on function public.get_daily_history() from public;
grant execute on function public.get_daily_history() to anon, authenticated;

alter table public.submissions add column if not exists challenge_date date;
update public.submissions
set challenge_date = (submitted_at at time zone 'Europe/London')::date
where challenge_date is null;
create index if not exists submissions_player_date_idx on public.submissions(lower(trim(display_name)), challenge_date);

create or replace function public.get_day_number(p_date date)
returns integer
language sql security definer set search_path = public
as $$
  select count(distinct challenge_date)::int from public.daily_challenges where challenge_date <= p_date;
$$;
revoke all on function public.get_day_number(date) from public;
grant execute on function public.get_day_number(date) to anon, authenticated;
