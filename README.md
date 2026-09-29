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

## Admin security
Set `ADMIN_EMAILS` to the email address(es) allowed to administer the site. Publishing uses a server-only route and the Supabase service-role key is never exposed to the browser.
