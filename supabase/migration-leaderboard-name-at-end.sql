alter table public.submissions
  add column if not exists attempt_id text;

create index if not exists submissions_attempt_id_idx on public.submissions(attempt_id);

-- Existing submissions keep their current leaderboard names. New daily attempts
-- use attempt_id while challenges are played, then receive the chosen leaderboard
-- name on the final submission screen.
