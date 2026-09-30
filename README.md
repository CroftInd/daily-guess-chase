# Daily Guess — production website

## Stack
Next.js App Router + TypeScript + Supabase Postgres/Auth/Storage + Vercel.

## Local setup
1. Create a Supabase project at https://database.new
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Create an admin email/password account in Supabase Authentication > Users.
4. Copy `.env.example` to `.env.local` and fill the Supabase URL, publishable key and service-role key.
5. Run `npm install`
6. Run `npm run dev`
7. Visit `/admin/login`.

## Vercel
1. Push this folder to GitHub.
2. Import the repo into Vercel.
3. Add the four environment variables from `.env.example`.
4. Deploy.
5. In Supabase Auth URL Configuration set the production Site URL and `https://YOUR-DOMAIN/auth/callback`.

## Important production hardening
The project deliberately calculates scores server-side. Never expose the service-role key to the browser. Before a large public launch, add:
- a dedicated admin role/claim and server-side admin checks;
- rate limiting/CAPTCHA on submissions;
- duplicate-submission policy if you want one attempt per person/day;
- moderation for leaderboard display names;
- private storage + signed URLs if direct video URLs should be hidden;
- monitoring/error tracking.

## Scoring
Text answers: normalized similarity >= 90%.
Age: within 10% of the official age.

## Large video uploads
The admin uploader uses a two-step flow: the server creates short-lived signed upload targets, the browser uploads media directly to Supabase Storage, and the server then saves the challenge metadata. This avoids Vercel serverless request-size limits that can cause large uploads to hang or fail.

## Admin security
Set `ADMIN_EMAILS` to the email address(es) allowed to administer the site. Publishing uses signed Supabase Storage upload URLs: the browser uploads the video directly to Storage, so large videos do not pass through the Vercel/Next.js function. The Supabase service-role key remains server-only and is never exposed to the browser.

## Four challenges per day
Each date now supports Challenge 1, 2, 3 and 4. Players enter their leaderboard name separately from the four guesses on each challenge. The daily maximum is 16 points.

### Existing database
If you already deployed an earlier Daily Guess version, run `supabase/migration-4-challenges.sql` once in the Supabase SQL Editor before deploying this version. Existing challenges become Challenge 1 for their date.


## Random daily challenge archive

Challenges are reusable archive entries rather than date-specific entries. After running `supabase/migration-random-archive.sql`, publish generic challenges from `/admin`. When the first player opens a date, the database creates and permanently stores a random set of four distinct published challenges for that date. Every player sees the same four challenges in the same order for that day. At least four published archive challenges are required.

## Admin challenge archive
The admin dashboard now includes a searchable archive of submitted challenges. Admins can edit answers/title, replace video or poster media, publish/unpublish challenges, and delete challenges that have never been used in a daily draw. Challenges already used in a daily draw are protected from deletion so historical daily assignments remain valid.

## Fix for daily challenges not generating at midnight

If you deployed an earlier random-archive version, run `supabase/migration-fix-daily-draw.sql` once in the Supabase SQL Editor. This fixes the daily random selection so four distinct published challenges are selected atomically and prevents duplicate-selection/unique-constraint failures at midnight.
