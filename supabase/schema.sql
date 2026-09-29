create extension if not exists pgcrypto;
create table if not exists public.challenges(id uuid primary key default gen_random_uuid(),challenge_date date not null unique,title text not null default 'Who is it?',video_path text not null,poster_path text,name_answer text not null,age_answer text not null,occupation_answer text not null,from_answer text not null,is_published boolean not null default false,created_by uuid references auth.users(id),created_at timestamptz not null default now());
create table if not exists public.submissions(id uuid primary key default gen_random_uuid(),challenge_id uuid not null references public.challenges(id) on delete cascade,user_id uuid references auth.users(id) on delete set null,display_name text not null,score smallint not null check(score between 0 and 4),submitted_at timestamptz not null default now());
alter table public.challenges enable row level security;
alter table public.submissions enable row level security;
create policy "published challenge metadata" on public.challenges for select using(is_published=true);
insert into storage.buckets(id,name,public) values('challenge-media','challenge-media',true) on conflict(id) do nothing;
create policy "public challenge media read" on storage.objects for select using(bucket_id='challenge-media');
-- Admin writes use the authenticated Supabase client in this starter. For launch, add an admin role/claim and restrict storage/database writes to it.
