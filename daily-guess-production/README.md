# Daily Guess — production website

Next.js App Router + TypeScript + Supabase Postgres/Auth/Storage + Vercel.

## Setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` for a fresh database, or run all applicable migrations if upgrading an existing Daily Guess installation.
3. For the current archive version, run `migration-random-archive.sql` and `migration-fix-daily-draw.sql` if they have not already been run.
4. Run `migration-all-features.sql` for the features in this release.
5. Create an admin email/password user in Supabase Authentication > Users.
6. Copy `.env.example` to `.env.local` and fill the Supabase URL, publishable key, service-role key and `ADMIN_EMAILS`.
7. `npm install` then `npm run dev`.
8. Deploy to Vercel and add the same environment variables.

## What's included
- Four reusable random challenges per day, fixed for everyone.
- Random selection prefers challenges that have not appeared recently, while gracefully falling back to the least recently used archive entries when the archive is small.
- Browser-level one-playthrough-per-day lock.
- Separate leaderboard/display name.
- 16-point daily score.
- Locked video with poster visible before submission; secure video URL is only requested after a successful submission.
- Live midnight countdown and automatic new-day refresh.
- Daily challenge number.
- Difficulty labels: Easy / Medium / Hard.
- Video duration indicator after unlock.
- Replay counter.
- Confidence rating for every answer.
- Accuracy percentage, personal best, streaks and fastest-day time.
- Speed used as the leaderboard tie-breaker without changing the 16-point maximum.
- Achievements.
- Daily and all-time leaderboards, rank position, daily winner and player profile.
- Past-day player results.
- Shareable score.
- Admin challenge archive with search, thumbnails, difficulty, preview, edit, publish/unpublish and protected deletion.
- Challenge usage statistics and per-question accuracy in the admin archive.
- Duplicate challenge warning.

## Deliberately excluded
- Progressive hints.
- Full-screen video button.
- Head-to-head mode.

## Existing database upgrades
If upgrading an existing deployment, run the migrations in Supabase SQL Editor. The new `migration-all-features.sql` adds challenge difficulty, stored answer/confidence data, elapsed answer time, challenge dates on submissions, player statistics helpers, challenge analytics and the improved daily selection function.

## Security
Correct answers remain server-side. The pre-submission page receives only challenge metadata/posters, never the video URL or correct answers. The service-role key is server-only. For a public launch, add rate limiting/CAPTCHA and monitoring.
