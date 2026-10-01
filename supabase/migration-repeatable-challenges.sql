-- Repeatable archived challenges
-- No schema change is required for this feature.
-- Submissions are intentionally scoped by challenge_date, so completing a
-- challenge on an earlier day does not prevent the same challenge being
-- answered again when it is selected on a later day.
--
-- This migration is informational and is safe to run in Supabase SQL Editor.
select 1 as repeatable_challenges_enabled;
