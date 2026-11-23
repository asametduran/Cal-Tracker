# Cal Tracker MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Photo-to-macros calorie tracker that runs on iOS, Android and web.

**Architecture:** Expo Router app with three screens. Screens only call `analyzeMeal` (`src/ai`) and the repositories (`src/data`). Backend and storage engine are chosen behind those seams.

**Tech Stack:** Expo (latest stable SDK), TypeScript, Expo Router, expo-image-picker, expo-sqlite (native) / localStorage (web), zod, reanimated, expo-haptics, Jest (`jest-expo`).

**Spec:** `docs/superpowers/specs/2026-11-23-cal-tracker-design.md`

## Global Constraints

- Platforms: iOS, Android, web.
- Backend selected by `EXPO_PUBLIC_AI_BACKEND` = `mock` | `gemini` | `proxy`, default `mock`.
- Gemini: key `EXPO_PUBLIC_GEMINI_API_KEY`, model default `gemini-3.8-flash`, override `EXPO_PUBLIC_GEMINI_MODEL`; throws when `__DEV__` is false.
- Default goals: 2000 kcal / 150 P / 200 C / 65 F.
- At most 3 to 4 screens; screens never import a concrete backend or storage engine.

## Review Focus

- AI returns non-food or malformed JSON: typed `AnalyzeError`, UI shows a retry message.
- Gemini key missing: clear error, not a network failure.
- User edits a number to empty/negative/non-numeric: rejected, save disabled.
- Meals near midnight: day key uses the local date, not UTC.
- Web `localStorage` unavailable or corrupted JSON: repository returns empty, never crashes.

---

### Task 1: Scaffold and tooling
**Files:** Create project via `create-expo-app` in this folder, `.env.example`, `.gitignore` entry for `.env.local`, `CLAUDE.md`, `docs/stages/*.md`, jest config.
**Produces:** runnable app, `npm test`, `npm run lint`.
- [ ] Scaffold default TypeScript template here, remove sample screens.
- [ ] Add deps, add `.env.example` with the three `EXPO_PUBLIC_*` variables.
- [ ] Write `CLAUDE.md` (staged framework, screen budget, seam rule).
- [ ] Verify: `npm test` runs and `npx tsc --noEmit` passes.

### Task 2: AI layer
**Files:** `src/ai/types.ts`, `analyzeMeal.ts`, `backends/mock.ts`, `backends/gemini.ts`, `backends/proxy.ts`, tests beside them.
**Produces:** `analyzeMeal(photo: PhotoInput): Promise<MealEstimate>`, `AnalyzeError`.
- [ ] Tests: mock returns valid estimate; gemini parses a valid response; rejects malformed JSON and negative numbers; missing key error; refuses when `__DEV__` false; request body contains inline image and schema.
- [ ] Implement with `fetch` injectable for tests; zod validation.
- [ ] Verify tests pass.

### Task 3: Data layer
**Files:** `src/data/types.ts`, `dayKey.ts`, `meals.native.ts`, `meals.web.ts`, `goals.*`, `index.ts`, tests.
**Produces:** `MealRepository`, `GoalsRepository`, `dayKey(date: Date): string` (local `YYYY-MM-DD`), `sumMeals(meals): Totals`.
- [ ] Tests: dayKey local date; sumMeals; web repo add/list/delete, corrupted storage returns empty.
- [ ] Implement web (localStorage) and native (expo-sqlite) repos behind the same interface.
- [ ] Verify tests pass.

### Task 4: Screens and reward
**Files:** `app/index.tsx` (Home), `app/capture.tsx`, `app/review.tsx`, `src/components/{Ring,MacroBar,MealRow}.tsx`, `src/state/pendingPhoto.ts`.
- [ ] Home: ring, macro bars, meals, Log meal button, goals sheet.
- [ ] Capture via expo-image-picker (camera on native, library everywhere).
- [ ] Review: calls `analyzeMeal`, editable validated fields, Save, animated reward and haptic.
- [ ] Verify: `npx tsc --noEmit`, lint, tests, and `npx expo export --platform web` succeed.
