# Supabase backend for Cal Tracker

What lives here:

| Path | What it is |
| --- | --- |
| `migrations/20261123000000_init.sql` | Tables (`profiles`, `meals`, `weight_logs`, `meal_reminders`, `ai_usage`), Row Level Security, sign-up trigger, AI quota function |
| `functions/analyze-meal/` | Edge Function: signed-in user sends a meal photo, Gemini returns calories and macros |
| `functions/_shared/meal.ts` | Prompt, response schema and validation, shared with the dev-only client backend and unit tested |
| `config.toml` | CLI config (`analyze-meal` requires a valid user JWT) |

Security model in one paragraph: the app only ever holds the **anon (publishable) key**, which is public by
design. Every table has RLS enabled and every policy is scoped to `auth.uid()`, so a signed-in user can only
touch their own rows and a signed-out request can touch nothing. The **Gemini key** and the **service-role key**
exist only inside Supabase (function secrets) and never reach the app.

## One-time setup

Run these from the project root. Steps 2 and 3 open a browser or ask for your database password, so type them in
your terminal (in Claude Code: prefix with `! `).

1. **Create the project.** In the [Supabase dashboard](https://supabase.com/dashboard) choose *New project*.
   Pick a region near you and save the database password. Then open *Project Settings > API* and copy:
   - **Project URL** (`https://<ref>.supabase.co`)
   - **anon / publishable key**
   - the **project ref** (the `<ref>` part of the URL)

2. **Log in and link the CLI.**
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   ```

3. **Create the schema.**
   ```bash
   npx supabase db push
   ```

4. **Store the Gemini key as a server-side secret** (use a key from https://aistudio.google.com/apikey):
   ```bash
   npx supabase secrets set GEMINI_API_KEY=<your-gemini-key>
   # optional: npx supabase secrets set GEMINI_MODEL=gemini-2.5-flash AI_DAILY_LIMIT=60 AI_BURST_LIMIT=6
   ```

5. **Deploy the function.**
   ```bash
   npx supabase functions deploy analyze-meal
   ```

6. **Configure auth** in the dashboard under *Authentication*:
   - *URL Configuration > Site URL*: `http://localhost:8081` (your deployed web URL later).
   - *URL Configuration > Redirect URLs*: add `http://localhost:8081`, `caltracker://**`, and, while developing in
     Expo Go, the `exp://…` pattern it prints. Password-reset and confirmation links only work for listed URLs.
   - *Providers > Email*: keep it enabled. *Confirm email* on is recommended; the app handles both settings.
   - *Policies > Password*: set the minimum length to 8 to match the app. The server default is 6 and the
     app's check can be bypassed by calling the auth API directly, so this setting is the real enforcement.
   - The app uses the PKCE flow: reset and confirmation emails carry `?code=...`, which only works on the
     device that requested the email.

7. **Point the app at it.** In `.env.local`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
   Set `EXPO_PUBLIC_AI_BACKEND=proxy` (or leave it unset), then restart `npx expo start`. The app has no
   client-side Gemini backend. Rotate any Gemini key that ever sat in a client env file.

## Checking it works

- Unauthenticated calls must be refused:
  ```bash
  curl -i -X POST https://<ref>.supabase.co/functions/v1/analyze-meal -H "Content-Type: application/json" -d "{}"
  # expect 401
  ```
- In the app: create an account, finish onboarding, scan a meal. Then sign in on a second browser or device and
  confirm your data appears.
- Row Level Security was verified against this exact migration in a local Postgres engine (33 checks: cross-user
  reads, updates, deletes, inserts and upsert hijacking all fail; signed-out access fails; quota function is
  service-role only). Re-run it after any schema change.

## How the app syncs

Reads always come from a per-user cache on the device, so screens are instant and reloads never flicker. Writes
apply to the cache immediately and go into a queue that is pushed to Supabase in order and retried until it
succeeds (offline edits are kept across restarts). On launch and when the app returns to the foreground it pushes
the queue and then refreshes the cache from the server. Conflict policy is last write wins. On sign-out the cache
is wiped (after confirming nothing is unsynced).

Known limits: the cache lives in AsyncStorage (about 6 MB on Android), so thousands of photo thumbnails would
outgrow it; move the cache to SQLite if that matters. Goals are not versioned, so the calendar's percentages use
today's targets for every past day.
