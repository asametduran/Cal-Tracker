# Build stages

Status key: [x] done, [ ] not started.

## 1. Core function
Photo in, estimated title + calories + protein + carbs + fat out.
- [x] `analyzeMeal(photo)` with `mock`, `gemini` (dev only) and `proxy` (stub) backends
- [x] Capture screen (camera or library/screenshot) and Review screen with editable numbers
- [ ] Verify against the real Gemini API (needs your key in `.env.local`; model ID `gemini-3.8-flash` is unverified)

## 2. Core loop
Log meals, hit daily calorie and macro goals, get rewarded each time.
- [x] Home screen: calorie ring, macro bars, today's meals, goals sheet
- [x] Save reward: ring and bar animation, count-up, "+N kcal" badge, success haptic (native)
- [ ] Tune the reward feel on a real device

## 3. Accessory features
- [x] Day navigation on Today (past days, jump back to today) and logging meals for past days
- [x] Tap a meal card to view its thumbnail, edit it, or delete it; add meals manually
- [x] Progress tab: monthly calendar with daily kcal and % of goal, tap a day to view/add/edit entries
- [x] Settings tab: goals plus customizable meal reminders (add, rename, retime, enable, delete)
- [ ] Verify reminders fire on a real phone (scheduling is mocked in tests; web can't schedule)
- [ ] Calendar % uses today's goals for every past day (goals are not versioned)
- Candidates still open: favorites, repeat a past meal.

## 4. Minimize surface area
Not started. Goal: stay at 3 to 4 screens; remove anything that is not the core loop.

## 5. Retention hook
Not started. Candidates: streaks, daily reminder. Added last, on purpose.

## Cloud backend (Supabase)
- [x] Schema with RLS on every table (`supabase/migrations/`), verified with 33 cross-user attack checks
- [x] Email/password auth: sign up, sign in, sign out, forgot + reset password
- [x] Local-first sync: instant cached reads, queued offline writes, background refresh, local data imported once
- [x] `analyze-meal` Edge Function + `proxy` backend; production bundle verified free of Gemini keys
- [ ] Create the Supabase project, push the migration, set `GEMINI_API_KEY`, deploy the function (`supabase/README.md`)
- [ ] Test sign-up/reset emails end to end, on web and on a phone (needs the redirect URLs configured)
- [ ] Move the on-device cache from AsyncStorage to SQLite if thumbnails outgrow ~6 MB on Android
