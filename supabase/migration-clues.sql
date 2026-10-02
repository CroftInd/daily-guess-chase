-- Daily Guess: per-question clues and clue-based leaderboard tiebreakers.
alter table public.challenges add column if not exists clues jsonb not null default '{}'::jsonb;
alter table public.submissions add column if not exists clue_usage jsonb not null default '{}'::jsonb;
alter table public.submissions add column if not exists clue_count smallint not null default 0 check(clue_count between 0 and 4);

-- Backfill a safe count if clue_usage already contains data.
update public.submissions
set clue_count = least(4, greatest(0, (select count(*) from jsonb_each(clue_usage) where value = 'true'::jsonb)))
where clue_count = 0 and clue_usage <> '{}'::jsonb;

-- Return safe clue text with the daily challenge metadata. Clues never contain the answer unless the admin chooses to put it there.
drop function if exists public.get_or_create_daily_challenges(date);
create or replace function public.get_or_create_daily_challenges(p_date date)
returns table(slot smallint, challenge_id uuid, title text, video_path text, poster_path text, difficulty text, clues jsonb)
language plpgsql security definer set search_path = public
as $$
declare existing_count integer; available_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('daily-guess:' || p_date::text));
  select count(*) into existing_count from public.daily_challenges where challenge_date=p_date;
  if existing_count < 4 then
    select count(*) into available_count from public.challenges c
    where c.is_published=true and not exists(select 1 from public.daily_challenges d where d.challenge_date=p_date and d.challenge_id=c.id);
    if existing_count + available_count < 4 then raise exception 'Not enough published challenges in the archive. At least four are required.'; end if;
    insert into public.daily_challenges(challenge_date,slot,challenge_id)
    select p_date,row_number() over(order by case when lu.last_used is null or lu.last_used < p_date-7 then 0 else 1 end,lu.last_used asc nulls first,random())::smallint+existing_count,c.id
    from public.challenges c
    left join lateral(select max(d.challenge_date) last_used from public.daily_challenges d where d.challenge_id=c.id and d.challenge_date<p_date) lu on true
    where c.is_published=true and not exists(select 1 from public.daily_challenges d where d.challenge_date=p_date and d.challenge_id=c.id)
    order by case when lu.last_used is null or lu.last_used < p_date-7 then 0 else 1 end,lu.last_used asc nulls first,random()
    limit (4-existing_count);
  end if;
  return query select d.slot,c.id,c.title,c.video_path,c.poster_path,c.difficulty,c.clues from public.daily_challenges d join public.challenges c on c.id=d.challenge_id where d.challenge_date=p_date order by d.slot;
end; $$;
revoke all on function public.get_or_create_daily_challenges(date) from public;
grant execute on function public.get_or_create_daily_challenges(date) to anon,authenticated;

drop function if exists public.get_public_daily_challenges(date);
create or replace function public.get_public_daily_challenges(p_date date)
returns table(slot smallint, challenge_id uuid, title text, poster_path text, difficulty text, clues jsonb)
language sql security definer set search_path=public as $$
 select d.slot,c.id,c.title,c.poster_path,c.difficulty,c.clues from public.daily_challenges d join public.challenges c on c.id=d.challenge_id where d.challenge_date=p_date and c.is_published=true order by d.slot;
$$;
revoke all on function public.get_public_daily_challenges(date) from public;
grant execute on function public.get_public_daily_challenges(date) to anon,authenticated;
