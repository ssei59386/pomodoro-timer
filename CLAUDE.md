# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

定期テスト学習進捗管理アプリ（Phase 0 最小版）— a mobile-first PWA that helps students maximize exam scores by managing per-chapter understanding levels: self-report/measure understanding → allocate study time to chapters that will move the score most → re-measure and re-plan. Target subjects in Phase 0 are 数学 (math) and 理科 (science) only. No backend, no login — all data lives in the browser's `localStorage`.

AI features, all 5 subjects, and rote-memorization mode are explicitly out of scope for this phase (see README.md). Forgetting-curve decay was originally listed as out of scope but has since been implemented — see `decayedUnderstanding` below.

## Commands

```bash
npm install      # install deps
npm run dev      # dev server at http://localhost:5173
npm run build    # tsc -b && vite build -> dist/
npm run preview  # serve the production build locally
npm test         # vitest run (all tests, single pass)
```

Run a single test file or case with vitest directly, e.g.:
```bash
npx vitest run src/logic.test.ts
npx vitest run -t "観測理解度"
```

There is no lint script configured.

## Architecture

**Pure core logic, dumb components.** Almost all business logic — understanding updates, priority scoring, plan generation, decay — lives in `src/logic.ts` as pure functions with no React/DOM dependency. Components call into these functions; they don't reimplement the math. `src/logic.test.ts` tests `logic.ts` directly. When changing scoring/allocation behavior, start in `logic.ts`.

**Data flow:** `src/types.ts` (data model) → `src/storage.ts` (localStorage read/write, key `study-planner-data-v1`) → `src/store.tsx` (React Context exposing `AppData` plus mutator functions like `completeOnboarding`, `recordSession`, `updateChapter`) → components under `src/components/` consume `useStore()`.

**Core domain model** (`src/types.ts`):
- `Subject` — math/science, has a `testDate`.
- `Chapter` — the unit of understanding tracking. Holds `understanding` (0.0–1.0), `targetUnderstanding` (default 0.8), `pointWeight` (exam point weight, used in priority scoring), `lastStudiedDate`, and optional `metadata` (exercise count, learning scope, difficulty — informational, not used in scoring).
- `StudySession` — a logged study session (chapter, minutes, correctRate, selfReport) that drives understanding updates.
- `AvailabilitySettings` — weekly recurring time slots (`weeklySchedule`, keyed by day-of-week 0–6) plus `dateOverrides` for one-off days (e.g. travel). This indirection is deliberate: a future calendar integration would only need to replace the input source, since plan generation always asks "how many minutes available on date X" via `availableMinutesForDate`.

**Core algorithms** (`src/logic.ts`):
- Understanding update (§6.1): `observed = 0.7×correctRate + 0.3×(selfReport/5)`, then exponentially smoothed: `understanding_new = 0.5×observed + 0.5×understanding_old`. Constants: `OBSERVED_CORRECT_WEIGHT`, `OBSERVED_SELF_WEIGHT`, `SMOOTHING_ALPHA`.
- Initial understanding (no sessions yet): self-report alone, or blended with a known recent correct-rate via `computeInitialUnderstanding`. If a chapter was broken into 2–4 sub-topics during onboarding, `averageInitialUnderstanding` averages their self-reports instead.
- Forgetting decay: `decayedUnderstanding(chapter, today)` exponentially decays `chapter.understanding` based on days since `lastStudiedDate`, half-life `FORGETTING_HALF_LIFE_DAYS = 21`. This is a **read-time-only** calculation — the stored `understanding` value itself is never mutated by decay. All scoring (`priority`) uses the decayed value, not the raw stored one.
- Priority score (§6.2): `priority = pointWeight × max(target − decayedUnderstanding, 0) × proximity`, where `proximity = 1 / daysLeft(testDate)`.
- Plan generation (§6.3, `generateTodayPlan`): greedy, single-chapter-focus allocation — sort chapters by priority descending, filter out chapters already at/above target (score ≤ 0), then consume `dailyMinutes` by assigning one chapter at a time up to `SESSION_MINUTES` (45 min) each, never splitting a chapter's time across the list mid-pass. `buildReasons` attaches human-readable justification labels (配点が高め / 理解度が低め / テストが近い) for display.

**Screens** (`src/App.tsx` tab router, gated by `data.onboarded`): Onboarding → Home (today's plan) → SessionRecord → Dashboard (understanding vs. target, days left) → Settings (edit/reset). `Onboarding.tsx` is also where subjects, chapters, point weights, initial self-reports, sub-topics, and optional metadata are entered; it's the most complex form in the app.

**PWA/deploy specifics** (`vite.config.ts`): `base` is `/` in dev but switches to `/pomodoro-timer/` on build, because the GitHub Pages workflow (`.github/workflows/deploy-pages.yml`) serves this as a project site. That workflow deploys on push to `master` or `claude/app-dev-per-plan-qur753`.

**Forward-compat note in storage:** `loadData()` spreads `initialData` under any parsed/stored data so newly added fields get sane defaults for users with older persisted state — preserve this pattern when adding fields to `AppData`/`Chapter`.

## Product direction (CEO judgment lens)

This project is moving from "Phase 0 prototype" toward "real product someone other than the developer will use." Product calls (what to build next, what to cut, how much polish before adding scope) should default to this prioritization:

1. **Ship-quality polish on the existing user journey beats new features.** A user who can't get through onboarding never sees the priority algorithm. Before adding a feature, ask whether the *existing* flow (onboarding → first plan → first session record) is solid.
2. **Cut before you add.** If a flow needs three options to explain itself, it needs fewer options, not better copy. Resist scope creep even when it's easy to add.
3. **The first few minutes are the highest-leverage place to invest.** Silent failures, no-escape-hatch flows, and unvalidated input in onboarding are P0s, not nice-to-haves — most users who'd churn, churn there.
4. **Don't expose Phase 1+ ambitions (AI, 5 subjects, rote-memorization mode) as partial UI or toggles in Phase 0.** They don't exist yet; half-built scope confuses users more than missing scope.

Apply this as a standing judgment lens, not literal role-play: when a request is ambiguous between "add a feature" and "fix the experience," default to the latter unless the user says otherwise.

**Subagents** (`.claude/agents/`):
- `ceo.md` — プロダクト優先順位・UX判断。何を作るか/削るかを決める。
- `cto.md` — 技術的実現可能性・実装コスト検証。CEOとペアで議論させる。
- `engineer.md` — **実装専担**。コード変更はすべてこのエージェントに委譲する。型チェック通過を完了条件とする。
- `ux-reviewer.md` — **UI/UX専門レビュアー**。実装後にコードを読んで中高生向けモバイルPWAとして問題ないか確認。ちょくちょく呼ぶ。

**ワークフロー：** ユーザーから実装タスクを受けたら、engineer エージェントに詳細仕様を渡して委譲する。実装が終わったら ux-reviewer エージェントを呼んで品質確認する。CEO/CTO は夜間会議および製品方向性の判断に使う。

**計画立案時の相談方針：** 実装計画を立てる段階で、UI設計の選択肢（例：カレンダーUI vs. シンプルな日付入力）や優先順位判断など、答えが自明でない論点が出たら、コードを書き始める前に該当する専門サブエージェント（ux-reviewer / ceo / cto）に具体的な質問を投げて意見を仰ぐ。ユーザーに都度判断を仰ぐ前に、まずサブエージェントの見解を集めてから選択肢を絞り込む。

**Nightly meeting (local)**: `scripts/nightly-meeting.bat` runs via Windows Task Scheduler. It calls `claude --dangerously-skip-permissions -p "..."` to start a local Claude Code session, which invokes the ceo/cto subagents for ~8 rounds of debate, then saves the result as a Gmail draft to ssei59386@gmail.com. Check Gmail drafts folder each morning for results. Execution log is appended to `scripts/nightly-meeting.log`. Everything runs locally — no cloud triggers, no remote sessions.

**Known gaps** — all originally-listed items are now **RESOLVED** as of 2026-07-01/02:
- ~~Input validation~~ — `isValidTimeSlot` / `isPastDate` added to `logic.ts`; validation wired into `Onboarding.tsx`, `WeeklyScheduleEditor.tsx`, `CalendarOverrides.tsx`, `Settings.tsx`.
- ~~Onboarding escape hatch~~ — resolved differently than originally framed: CEO/CTO subagents concluded onboarding already had a working minimal-completion path (only 1 chapter is required — `named.length === 0` is the only chapter-count check in `handleSubmit`; subtopics/metadata/2nd subject/date-overrides are all optional), so a draft-persistence "save and continue later" mechanism was rejected as unneeded complexity. The one real silent-failure gap found instead: submitting with zero weekly time slots produced a permanently-empty daily plan with no explanation. Fixed by adding a `handleSubmit` check requiring at least one valid slot across `weeklySchedule` (`Onboarding.tsx`), plus a `WeeklyScheduleEditor` inline notice when no valid slot exists yet.
- ~~`storage.ts` silent write failures~~ — `saveData` now returns `boolean`; `store.tsx` tracks `saveError` state (resets to `false` on next successful save) and exposes it via `StoreValue`; `App.tsx` renders a sticky warning banner (`.save-error-banner` in `styles.css`) when true.
- ~~Sub-topics can't be edited post-onboarding~~ — see "Resolved" entries below (`ChapterSubtopic`, name-only, informational).
- ~~No tests for `store.tsx`, `storage.ts`, or any component~~ — `@testing-library/react` + `jsdom` added (`vite.config.ts` now imports `defineConfig` from `"vitest/config"`, `test: { environment: "jsdom" }`). New test files: `src/storage.test.ts` (7 tests), `src/store.test.tsx` (6 tests, incl. `saveError` toggling), `src/App.test.tsx` (3 tests, onboarding gate + tab switching), `src/components/WeeklyScheduleEditor.test.tsx` (4 tests). Total suite: 54 tests across 5 files. Deliberately not covered yet: `Onboarding.tsx`, `Settings.tsx`, `SessionRecord.tsx`, `Dashboard.tsx`, `CalendarOverrides.tsx`, `DateOverridesList.tsx` — see Next tasks.

**Phase 0 status: functionally complete per README's "できること" list.** All 5 screens exist and work; all previously-known gaps above are resolved. What's left is polish/backlog items (below), not missing features.

**Recent changes (2026-07-01 session)**:
- `WeeklyScheduleEditor`: added `showInitialSlots` prop — when true, each day row shows an empty time input by default (no need to click "＋ add" first). Used in Onboarding.
- `Onboarding`: added "特別な予定" section so irregular days can be set at setup time, not just in Settings later. `dateOverrides` is now passed to `completeOnboarding` (was hardcoded `{}`). After a ux-reviewer audit flagged the initial version (full `CalendarOverrides` calendar-grid UI embedded directly in the required onboarding flow) as a regression against the "cut before you add" principle, it was reworked: the section is now collapsed by default (`showDateOverrides` state, starts `false`, revealed by a "特別な予定を設定する" button) with an "任意" badge, and uses a new onboarding-only component `src/components/DateOverridesList.tsx` — a simple stacked list of `<input type="date">` + time-slot rows, rather than the calendar-grid UI. `CalendarOverrides` itself is unchanged and still used by `Settings.tsx`.
- Onboarding now requires at least one valid weekly time slot before submit (see Known gaps above); `WeeklyScheduleEditor` shows "毎日の勉強できる時間はまだ入力されていません。" when none exist yet.
- `storage.ts`/`store.tsx`/`App.tsx`: added user-facing feedback for `localStorage` write failures (see Known gaps above).
- `.claude/agents/`: added `engineer.md` (implementation-only agent) and `ux-reviewer.md` (UI/UX review agent). Workflow: delegate code changes to `engineer`, then call `ux-reviewer` to verify. Also added a standing instruction (see "計画立案時の相談方針" above) to proactively consult ceo/cto/ux-reviewer on ambiguous design questions during planning, before writing code.

**Product call (2026-07-01): `grade` field on `Subject` — declined for now.** CEO subagent's call: adding `grade?: string` now, ahead of any actual AI comprehension-test feature, is dead weight either way — as a bare type with no UI it'll likely be redesigned once Phase 1 fixes the real shape/granularity needed, and as an onboarding input it asks users to fill in a field nothing reads yet. Revisit only when Phase 1's AI test-generation feature is actually being scoped, and add type + UI together at that point.

**Next tasks (carry into next chat)** — a ux-reviewer pass after closing out the items above (2026-07-02) surfaced a new backlog, roughly priority order:
1. **Policy violation, small fix already applied**: `Onboarding.tsx`'s metadata-block description used to read "学習メタデータ（任意・AI問題生成などで活用）" — this exposed a Phase 1+ ambition (AI test generation) directly in Phase 0 UI, against this file's own "Product direction" rule #4. Changed to the neutral "学習メタデータ（任意・あとで使う項目です）".
2. The chapter-registration card in `Onboarding.tsx` (~line 311-470) packs up to 9 fields per chapter (subject/name/point weight/exercise count/learning scope/difficulty/2-4 subtopics each with a 5-way self-report/self-report/recent correct-rate), and the `metadata-block` fields (exercise count, learning scope, difficulty) are purely informational — never used in scoring (confirmed in this file's own Architecture section). Consider hiding `metadata-block` from the first-pass onboarding card and moving it to a post-onboarding edit surface (Settings already has a per-chapter edit area as of the subtopics work), consistent with "cut before you add".
3. `Home.tsx` (~line 33-36) collapses two different empty-plan reasons ("all chapters already at target" vs. "zero available minutes today") into one ambiguous message; they call for different user action (celebrate vs. fix availability settings) and `generateTodayPlan`'s inputs already distinguish them.
4. `SessionRecord.tsx` (~line 46-52) and `Dashboard.tsx` (~line 35) both have a "no chapters yet" empty state that's text-only, no button to jump to Settings (tab bar is always visible so not a dead end, just an extra tap).
5. Settings screen's `WeeklyScheduleEditor` (no `showInitialSlots`) allows saving with all weekly slots removed/empty with no warning, silently producing a permanently-empty Home plan (same class of issue as the now-fixed Onboarding gap, just not gated since Settings changes save immediately rather than going through a single submit step). Consider a lightweight non-blocking notice, not a hard validation block.
6. Test coverage still doesn't include `Onboarding.tsx`, `Settings.tsx`, `SessionRecord.tsx`, `Dashboard.tsx`, `CalendarOverrides.tsx`, `DateOverridesList.tsx` — the two-part test-infra work above only covered `storage.ts`/`store.tsx`/`App.tsx`/`WeeklyScheduleEditor.tsx`.
7. Product idea under discussion (not yet scoped): generate a comprehension test calibrated to the school's actual exam level + the student's understanding gap, using richer per-chapter material (possibly student-uploaded notebook photos). Copyright risk flagged for anything beyond the student's own handwritten notes (textbook/workbook pages, official past exams are third-party copyrighted material — Japan's 著作権法30条の4 AI-training exception is contested for generative reuse). Needs real legal review before scoping; treat as Phase 1+ only.
8. Related idea (not yet scoped): make the generated daily-plan text more specific (e.g. page ranges, which subtopic to focus on) by surfacing the already-collected `ChapterMetadata.learningScope`/`exerciseCount` and `Chapter.subtopics` names in `generateTodayPlan`'s output, instead of just the chapter name. Deliberately keep new required onboarding fields to zero; prefer surfacing what's already collected.

**Resolved (2026-07-01/02)**: Sub-topics entered during onboarding used to vanish after being averaged into the chapter's initial `understanding` — no persistence, no post-onboarding edit UI. Fixed with a deliberately light scope (user's call): added `ChapterSubtopic { id, name }` and `Chapter.subtopics?: ChapterSubtopic[]` (`types.ts`) as a **name-only, informational** list — no per-subtopic understanding tracking or session-recording linkage. `Onboarding.tsx` now persists the named subtopics onto the built `Chapter`; `Settings.tsx` got an add/rename/remove UI per chapter (reuses the `subtopic-block`/`subtopic-row` CSS from `Onboarding.tsx`). The heavier alternative (subtopic-level understanding + `SessionRecord` targeting) was explicitly declined as out of scope for now.

**Resolved (2026-07-01/02)**: Onboarding's top-level validation error (`error` state) used to render only near the submit button, so a mistake in an earlier section wasn't visible without scrolling down. Fixed by adding refs to each `<section className="card">` (test date / weekly schedule / date overrides / chapters) and calling `scrollIntoView({ behavior: "smooth", block: "start" })` on the relevant section right before each `setError(...)` in `handleSubmit`.

**Resolved (2026-07-02)**: Closed out the remaining Phase 0 backlog in one session — (1) `WeeklyScheduleEditor`'s "まだ入力されていません" notice now suppressed when `showInitialSlots` is true (Onboarding already shows empty inputs per day, so the notice was redundant there; still shown in Settings where empty days render no input at all), (2) `.calendar-cell` (`CalendarOverrides.tsx`, Settings-only) got `min-height: 44px` + `justify-content: center` for tap-target size, (3) test infrastructure + tests added (see Known gaps above). ux-reviewer confirmed both UI changes read as intentional rather than inconsistent, and no blocking issues remain — see Next tasks above for what it found instead.
