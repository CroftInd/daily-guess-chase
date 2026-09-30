create extension if not exists pgcrypto;

-- Reusable challenge archive. challenge_date/challenge_number are kept nullable
-- for backwards compatibility with older Daily Guess databases.
create table if not exists public.challenges(
  id uuid primary key default gen_random_uuid(),
  challenge_date date,
  challenge_number smallint check(challenge_number between 1 and 4),
  title text not null default 'Who is it?',
  video_path text not null,
  poster_path text,
  name_answer text not null,
  age_answer text not null,
  occupation_answer text not null,
  from_answer text not null,
  is_published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_challenges(
  challenge_date date not null,
  slot smallint not null check(slot between 1 and 4),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(challenge_date,slot),
  unique(challenge_date,challenge_id)
);

create index if not exists daily_challenges_date_idx on public.daily_challenges(challenge_date);

create table if not exists public.submissions(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  score smallint not null check(score between 0 and 4),
  submitted_at timestamptz not null default now()
);

alter table public.challenges enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.submissions enable row level security;

create policy "published challenge metadata" on public.challenges for select using(is_published=true);
create policy "daily challenge assignments readable" on public.daily_challenges for select using(true);

insert into storage.buckets(id,name,public)
values('challenge-media','challenge-media',true)
on conflict(id) do nothing;

create policy "public challenge media read"
on storage.objects for select using(bucket_id='challenge-media');

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

    insert into public.daily_challenges(challenge_date,slot,challenge_id)
    select p_date, gs.slot, picks.id
    from generate_series(existing_count + 1,4) as gs(slot)
    join lateral(
      select c.id
      from public.challenges c
      where c.is_published = true
        and not exists(
          select 1 from public.daily_challenges d
          where d.challenge_date = p_date and d.challenge_id = c.id
        )
      order by random()
      limit 1
    ) picks on true;
  end if;

  return query
  select d.slot,c.id,c.title,c.video_path,c.poster_path
  from public.daily_challenges d
  join public.challenges c on c.id=d.challenge_id
  where d.challenge_date=p_date
  order by d.slot;
end;
$$;

revoke all on function public.get_or_create_daily_challenges(date) from public;
grant execute on function public.get_or_create_daily_challenges(date) to anon,authenticated;
