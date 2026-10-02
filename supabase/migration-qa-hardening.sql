-- Daily Guess QA hardening: robust daily slot generation and useful indexes.
-- Safe to run after the existing archive/all-features migrations.

create or replace function public.get_or_create_daily_challenges(p_date date)
returns table(slot smallint, challenge_id uuid, title text, video_path text, poster_path text, difficulty text)
language plpgsql security definer set search_path = public
as $$
declare
  missing_slots smallint[];
  need_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('daily-guess:' || p_date::text));

  select coalesce(array_agg(s.slot order by s.slot), '{}'::smallint[])
    into missing_slots
  from generate_series(1,4) as s(slot)
  where not exists (select 1 from public.daily_challenges d where d.challenge_date=p_date and d.slot=s.slot);

  need_count := coalesce(array_length(missing_slots,1),0);

  if need_count > 0 then
    if (select count(*) from public.challenges c where c.is_published=true
        and not exists (select 1 from public.daily_challenges d where d.challenge_date=p_date and d.challenge_id=c.id)) < need_count then
      raise exception 'Not enough published challenges in the archive. At least four are required.';
    end if;

    with picks as (
      select c.id, row_number() over (order by random())::int as rn
      from public.challenges c
      where c.is_published=true
        and not exists (select 1 from public.daily_challenges d where d.challenge_date=p_date and d.challenge_id=c.id)
      order by random()
      limit need_count
    ), slots as (
      select unnest(missing_slots)::int as slot, row_number() over (order by unnest(missing_slots))::int as rn
    )
    insert into public.daily_challenges(challenge_date,slot,challenge_id)
    select p_date,s.slot,p.id from picks p join slots s using(rn);
  end if;

  return query
  select d.slot,c.id,c.title,c.video_path,c.poster_path,
         coalesce(c.difficulty,'medium')
  from public.daily_challenges d
  join public.challenges c on c.id=d.challenge_id
  where d.challenge_date=p_date
  order by d.slot;
end;
$$;

revoke all on function public.get_or_create_daily_challenges(date) from public;
grant execute on function public.get_or_create_daily_challenges(date) to anon, authenticated;
