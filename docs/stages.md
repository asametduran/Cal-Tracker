# Build stages

Status key: [x] done, [ ] not started.

## 1. Core function
Photo in, estimated title + calories + protein + carbs + fat out.
- [x] `analyzeMeal(photo)` with `mock` and `proxy` backends (the proxy is the Supabase Edge Function; there is no client-side Gemini)
- [x] Capture screen (camera or library/screenshot) and Review screen with editable numbers
- [ ] Verify a real photo end to end through the deployed proxy (sign in, scan, check the estimate)

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
- [x] Supabase project linked, migrations pushed, `GEMINI_API_KEY` set, `analyze-meal` deployed (`supabase/README.md`)
- [x] Security hardening: PKCE auth links, Keychain/Keystore session storage, image magic-byte check, per-minute burst limit, quota refund on provider failure
- [ ] Dashboard: minimum password length 8 and redirect URLs; rotate the Gemini key
- [ ] Test sign-up/reset emails end to end, on web and on a phone (needs the redirect URLs configured)
- [ ] Move the on-device cache from AsyncStorage to SQLite if thumbnails outgrow ~6 MB on Android
