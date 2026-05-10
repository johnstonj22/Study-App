# Study App

A personal knowledge trainer (web). Users create topics, attach flashcards and short-answer questions, and review them on a spaced-repetition schedule scaled by a daily study quota and per-topic priorities. A calendar surfaces how the queue spreads across upcoming days.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind v4**
- **Supabase** (Postgres + Auth + RLS) via `@supabase/ssr` (NOT the deprecated `auth-helpers`)
- **Zod** for input validation in service modules + Server Actions
- **Vitest** for unit tests (scheduler module — per-item updates + distribution algorithm)
- Database types are **generated** via `npx supabase gen types typescript --linked > lib/types/database.ts`. Never edit `database.ts` by hand.

## Architecture rule (must hold)

`lib/services/*`, `lib/scheduler.ts`, and `lib/types/*` must NOT import from `next/*`, `react`, `next/headers`, `next/navigation`, etc. They must stay framework-agnostic so they can later be lifted into a `packages/core` workspace for the future Expo mobile app.

**Pattern:** every service function takes a `SupabaseClient<Database>` as its first argument. The client is created at the framework boundary (`lib/supabase/server.ts` or `lib/supabase/client.ts`) and passed in. Services don't know whether they're running on the server, in the browser, or eventually in React Native.

## Where things live

```
app/
  (auth)/login/page.tsx            # sign-in / sign-up form (client)
  (app)/
    layout.tsx                     # auth-gated shell with header + <TimezoneSync>
    dashboard/page.tsx             # quota progress + topic lists
    topics/page.tsx
    topics/new/page.tsx
    topics/[id]/page.tsx
    topics/[id]/flashcards/new/page.tsx
    topics/[id]/short-answer/new/page.tsx
    review/page.tsx                # today's quota bucket + bonus list
    calendar/page.tsx              # month grid: past completed / today live / future projected
    study-plan/page.tsx            # daily quota + per-topic priorities
    timezone-action.ts             # syncTimezoneAction (server action invoked by <TimezoneSync>)
  page.tsx                         # root: redirects to /dashboard or /login
  layout.tsx                       # root layout, fonts + metadata

components/                        # presentational + small client components
  CalendarMonthGrid.tsx            # pure cell-list renderer (page builds the cells)
  ReviewQueue.tsx                  # goal/bonus phase machine
  StudyPlanForm.tsx                # daily_quota editor
  TopicPriorityForm.tsx            # batch priority editor (one form, all topics)
  TimezoneSync.tsx                 # one-shot browser-tz detection effect
  ...

lib/
  scheduler.ts                     # PURE. Per-item placeholder + distribution algorithm.
  supabase/{server,client,middleware}.ts
  services/                        # PURE
    profiles.ts                    # getProfile, updateStudyPlan, updateTimezone, schemas
    topics.ts                      # CRUD + getTopicPriorities + updateTopicPriorities
    flashcards.ts
    shortAnswerQuestions.ts
    reviews.ts                     # getDueQueue, getDueCount, getItemsInWindow,
                                   # getCompletedCountsByDay, recordReview
  types/{database.ts,domain.ts}    # PURE

middleware.ts                      # session refresh + route gating

supabase/
  config.toml
  migrations/
    0001_initial_schema.sql
    0002_rls_policies.sql
    0003_profile_trigger.sql
    0004_record_review_function.sql
    0005_daily_quota.sql           # profiles.daily_quota int default 10 (1-200)
    0006_topic_priority.sql        # topics.priority int (1-99)
    0007_topic_priority_default_1.sql # priority default → 1

tests/
  scheduler.test.ts                # calculateReviewUpdate
  scheduler-distribution.test.ts   # distributeAcrossDays + orderForBonus + interleaveByType
```

## Server Actions pattern

Server Actions live next to the routes that use them. They:

1. Validate input with the Zod schema exported from the matching service module.
2. Auth-check via `supabase.auth.getUser()`.
3. For child resources (flashcards, short-answer questions), do a defensive `getTopic` lookup first — RLS-scoped, so it returns null for foreign-owned topics. This prevents users from inserting children under topics they don't own (RLS alone won't catch this since FK validation bypasses RLS).
4. Call the service function.
5. `revalidatePath` the affected pages.
6. `redirect` on success. **Never wrap `redirect()` in try/catch** — it throws by design.

Forms use `useActionState` + `useFormStatus`. Action signature: `(prev: FormState, formData: FormData) => Promise<FormState>` where `FormState = { error: string | null; saved?: boolean }`.

For actions taking extra args (e.g., `createFlashcardAction(topicId, prev, formData)`), bind in the client with `action.bind(null, topicId)` rather than using a hidden form field — stronger typing and not tamperable.

**Multi-row forms** (e.g., `TopicPriorityForm`): all rows share one form, fields named `priority_<topic_id>`. The action iterates `formData.entries()`, validates each row through Zod, and calls a service function that runs the updates in parallel.

## Distribution and scheduling

Two distinct layers in [lib/scheduler.ts](lib/scheduler.ts):

### 1. Per-item update (placeholder)

`calculateReviewUpdate(currentMastery, rating, now)` — fixed intervals (Again→10min, Hard→1d, Good→3d, Easy→7d) and fixed mastery deltas (−15/+2/+8/+15 clamped to [0,100]). Intentionally simple. The `flashcards` / `short_answer_questions` tables already carry `ease_factor`, `interval_days`, `repetitions` columns for a future SM-2 / FSRS upgrade — they sit unused at defaults (2.5 / 0 / 0). Upgrading swaps this function and updates the `record_review` Postgres function.

### 2. Distribution across days (real)

`distributeAcrossDays(items, startDate, numDays, prefs, timezone)` — pure greedy water-fill that maps eligible items onto consecutive days. For each day in order:

1. Eligible pool = items whose `next_review_at` falls before that day's local end.
2. `target = min(eligible.length, prefs.dailyQuotas[i])`.
3. Allocate via `allocateForDay`:
   - Type split per `flashcardRatio` (default 50/50, with leftover redistribution if one type is short).
   - Within each type, `splitByTopic` allocates **by priority tier**: priority-1 items fully before priority-2, etc. Within an oversubscribed tier, even-split across topics with earliest-due as remainder tie-break.
   - Output is round-robin by topic within each tier, then alternated across types via `interleaveByType` — so a session shows variety along both axes.
4. Allocated items are removed from the master pool; advance to next day.

`orderForBonus(items, priorities)` — same shape, but treats the entire input as one ordered list: priority-1 first (interleaved by topic + type), then priority-2, etc.

### The distribution is a pure projection

It is **never written back to the database**. Every render of `/review`, `/calendar`, `/dashboard` recomputes from current items + `review_history` count for today + priorities + quota. Implications:

- **Missed days don't pin items.** Yesterday's calendar cell shows only `review_history` count — blank if zero. Items whose `next_review_at` is yesterday simply land in today's eligible pool and re-allocate from scratch.
- **Live progress.** Each `rateItemAction` revalidates `/review`, `/calendar`, `/dashboard`. The `completedToday` prop flows back into the queue; future days shrink as items get rated.
- **Instant rebalance.** Changing the quota or any topic priority on `/study-plan` recomputes everything on next render. No migration / sync needed.

## Daily quota

`profiles.daily_quota` (int, 1–200, default 10). Edited on `/study-plan` via [components/StudyPlanForm.tsx](components/StudyPlanForm.tsx).

The review page presents two ordered lists:

- **goalItems** — `distributeAcrossDays(eligible, today, 1, { dailyQuotas: [dailyQuota - completedToday], ... })`. The "today's bucket" capped by remaining quota.
- **bonusItems** — `orderForBonus(eligible.filter(not in goal), priorities)`. Everything else eligible today, priority-ordered.

`<ReviewQueue>` is a phase machine: `goal → goal-complete → (continue?) → bonus → all-done`. The interstitial shows live `completedToday / dailyQuota`. The "Continue with N more" button starts the bonus list.

The dashboard's primary stat reads `completedToday / (completedToday + remainingBucket)` — never the full backlog. That's intentional: surfacing 80 items in the queue stresses people; surfacing "3 of 10 today" doesn't.

## Topic priorities

`topics.priority` (int, 1–99, default 1; **lower = higher priority**). Edited on `/study-plan` via [components/TopicPriorityForm.tsx](components/TopicPriorityForm.tsx) — single form lists every topic with a numeric input, batch-saved.

Strict tier-based scheduling: priority-1 items are placed in full before any priority-2 item appears in any day's bucket. Topics sharing a number split evenly within their tier. Sets of topics at the same priority are how you say "treat these as equally important — divide my time fairly between them."

`getTopicPriorities(client)` returns `Map<topic_id, number>` and is fetched alongside items in `/review`, `/calendar`, `/dashboard`.

## Timezone

`profiles.timezone` (text, default 'UTC'). Auto-detected by [components/TimezoneSync.tsx](components/TimezoneSync.tsx) — a tiny client component mounted in `(app)/layout.tsx` that reads `Intl.DateTimeFormat().resolvedOptions().timeZone` once per browser session (gated by `sessionStorage["tz-synced"]`) and calls `syncTimezoneAction` to persist it if it differs. No UI.

All day-boundary math goes through `startOfLocalDay(year, month, day, tz)` and `startOfDayInTimezone(date, tz)` from `lib/scheduler.ts`. They use an Intl-based offset probe so DST transitions are handled correctly (a "spring forward" day is 23h, "fall back" is 25h — fixed 24h ticks would drift the local boundary). The distribution algorithm walks days by calendar Y-M-D arithmetic, not by adding 24h, for the same reason.

## Calendar

`/calendar` renders a 5–6 row month grid via [components/CalendarMonthGrid.tsx](components/CalendarMonthGrid.tsx). The page builds an explicit `CalendarCell[]`:

- **Past day** — `completedByDate.get(key) ?? 0`. Blank if zero.
- **Today** — `completed / (completed + bucket.length)` plus a small `F: x · S: y` type breakdown. Ringed.
- **Future day** — `bucket.length` plus the same breakdown.

Past completed counts come from `getCompletedCountsByDay(supabase, gridStart, gridEnd, tz)` which aggregates `review_history` by date in tz. Future buckets come from `distributeAcrossDays` projected from today through the grid's end. Past months render with no projection (just history aggregates).

Navigation: `?month=YYYY-MM` query param, `←` / `→` / `Today` links.

## Database

- All user-data tables have `user_id` referencing `auth.users(id) on delete cascade`. RLS policies in `0002_rls_policies.sql` scope every operation to `auth.uid()`.
- `review_history.topic_id` uses `ON DELETE SET NULL` so history survives topic deletion.
- `review_history` has two nullable FK columns (`flashcard_id`, `short_answer_id`) with a CHECK constraint that exactly one is set — no polymorphic `item_type + item_id`.
- `record_review` Postgres function (`security invoker`) is the transactional write path for reviews: locks the item row, reads previous mastery, updates the item (`mastery_score`, `last_reviewed_at`, `next_review_at`), inserts the history row.
- Profiles auto-created via `on_auth_user_created` trigger on `auth.users` insert.
- "Enable automatic RLS" event trigger is on (extra safety net for any future tables).

Schema additions since MVP:
- `profiles.daily_quota int not null default 10 check (between 1 and 200)` — migration 0005.
- `topics.priority int not null default 1 check (between 1 and 99)` — migrations 0006 + 0007 (default raised to 1).

## Deferred / known-incomplete

- **Real scheduler.** `calculateReviewUpdate` is a placeholder by user choice. SM-2 columns reserved on flashcards / short_answer_questions.
- **Topic mastery rollup.** Nothing aggregates per-item mastery up to `topics.mastery_score`. Affects "Weakest topics" on dashboard and the mastery badge on topic cards. Two fix paths: compute-on-read in services (simple, slower) or extend `record_review` + child-delete hooks (faster reads, more code).
- **Type-ratio UI.** `DistributionPrefs.flashcardRatio` is plumbed everywhere but the user controls it from no UI yet — defaults to 0.5 (50/50).
- **Manual timezone override.** Auto-detect handles all common cases. Adding a manual override would need a "lock against re-detect" flag on the profile so the next page load doesn't clobber the chosen value.
- **Per-day click-through on the calendar.** Cells are read-only. Could open a modal listing that day's items.
- **AI features** (question generation, grading, computational problem variants), **file uploads**, **deep study sessions**, **mastery map**, **push notifications**, **Expo mobile app** — explicitly out of MVP scope.

## Common commands

```
npm run dev                                     # Next.js dev server
npm run build                                   # production build
npm test                                        # run vitest once
npm run test:watch                              # vitest watch mode

npx supabase db push                            # apply pending migrations to remote DB
npx supabase gen types typescript --linked > lib/types/database.ts   # regen types after schema changes
```

**Important:** when running `gen types`, do NOT use `2>&1` — the CLI prints "Initialising login role..." to stderr, which would corrupt the output file.

## Workflow preferences

- Build incrementally, one milestone at a time, then **stop for review** before starting the next. Don't batch multiple milestones in a single uninterrupted run.
- Don't auto-update this file. Suggest changes when significant decisions are made and let the user apply them.

## Plan file

Original implementation plan: `C:\Users\bugbu\.claude\plans\i-have-this-plan-linked-sphinx.md`. Useful for the original architectural reasoning. The calendar/quota/priority milestone plan (which extended the MVP) is at `C:\Users\bugbu\.claude\plans\we-are-continuing-work-noble-shannon.md`.
