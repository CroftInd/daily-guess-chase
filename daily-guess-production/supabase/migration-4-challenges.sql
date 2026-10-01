-- Run this ONCE in Supabase SQL Editor on an existing Daily Guess database.
alter table public.challenges add column if not exists challenge_number smallint not null default 1;
alter table public.challenges drop constraint if exists challenges_challenge_date_key;
alter table public.challenges add constraint challenges_date_number_key unique(challenge_date, challenge_number);
alter table public.challenges add constraint challenges_number_range check(challenge_number between 1 and 4);
