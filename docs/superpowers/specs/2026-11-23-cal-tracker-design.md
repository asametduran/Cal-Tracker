# Cal Tracker – Design

Status: approved by the owner ("Let's start building the full MVP now!").

## Intent and why

A mobile app, in the spirit of Cal AI, where a user photographs a meal, AI estimates calories and macros, the user makes minor corrections, and the meal is added to the day's totals. Logging should be fast and rewarding enough that users return every time they eat.

The owner builds with a staged framework, and the project follows it in order:
1. Core function
2. Core loop
3. Accessory features
4. Minimize surface area
5. Retention hook

## Goals

- Photo (or screenshot) in, estimated meal title, calories, protein, carbs and fat out.
- Review screen where the user can adjust the numbers before saving.
- Home screen showing today's calories and macros against goals at a glance.
- A visual and haptic reward every time a meal is saved.
- Fully local data, with a clean seam for moving to a database later.
- Runs on iOS, Android, **and web** (web is for testing the UI and image upload in Chrome before Expo Go).

## Non-goals

- Accounts, sync, social features, barcode scanning, history analytics, notifications.
- Shipping a build that holds an AI key.

## Anti-goals

- Surface area creeping past 3 to 4 screens.
- A production build that contains or uses an extractable API key.
- Screens that know which AI backend or storage engine is running.

## Constraints

- Expo + React Native + TypeScript, Expo Router.
- `EXPO_PUBLIC_*` variables are inlined into the JS bundle, so anything in them is public.
- Dev machine: Windows 10, Node 24, npm 11.

## Approaches

**AI access:** direct call (dev only) vs proxy vs **one `analyzeMeal(photo)` with mock, direct Gemini, and proxy backends (chosen by the owner).**

**Storage (my call):** `MealRepository` interface with two implementations picked by platform file extension: `expo-sqlite` on iOS/Android, and `localStorage` on web (`*.web.ts`). This avoids `expo-sqlite` web bundling issues entirely. A future remote database is a third implementation of the same interface.

## Decisions

### AI layer (`src/ai/`)
- `analyzeMeal(photo: { uri; base64; mimeType }): Promise<MealEstimate>`
- `MealEstimate = { title, calories, proteinG, carbsG, fatG }`
- Backend from `EXPO_PUBLIC_AI_BACKEND` = `mock` | `gemini` | `proxy` (default `mock`).
- **Gemini dev backend:** REST `generateContent` with inline image data, JSON response mode plus a response schema for the five fields, validated at runtime (zod). Model ID defaults to `gemini-3.8-flash`, overridable via `EXPO_PUBLIC_GEMINI_MODEL`. Key from `EXPO_PUBLIC_GEMINI_API_KEY` in `.env.local`. Throws when `__DEV__` is false.
- **Proxy:** stub, built before release. **Mock:** fixed plausible results with a delay.

### Data layer (`src/data/`)
- `MealRepository`: `addMeal`, `listMealsForDay`, `deleteMeal`. `GoalsRepository`: `getGoals`, `setGoals`.
- Default goals 2000 kcal / 150 P / 200 C / 65 F.

### Screens (3 to 4)
1. **Home:** calorie ring, three macro bars, today's meals, "Log meal" button. Goals editing is a sheet on Home, not its own screen.
2. **Capture:** take a photo (native camera) or pick an image (library, screenshots, and Chrome file upload) through `expo-image-picker`.
3. **Review:** photo, AI estimate, editable numbers, Save.

### Reward
On save: animated ring and bar fill, count-up of totals, and a haptic tap (`react-native-reanimated`, `expo-haptics`).

## Left to the builder
Package versions (latest stable Expo SDK), exact styling, image downscaling before upload.

## Open items
- **Model ID:** `gemini-3.8-flash` is used as specified, but I could not verify it exists. If rejected, change `EXPO_PUBLIC_GEMINI_MODEL` only.
- **Dev key exposure:** a key in `EXPO_PUBLIC_*` is visible in the bundle, including the web build. Use a restricted, low-quota key and don't share dev builds.
- **Release path:** the proxy must exist before any store or TestFlight build.
