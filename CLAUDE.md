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

**セッション引き継ぎ時のcommit/push方針（ユーザー指定、2026-07-02）：** ユーザーから「引き継ぎをして」「新しいチャットに行く」など、セッションの区切り・引き継ぎを依頼された場合、CLAUDE.md等への引き継ぎ内容の記録に加えて、その時点までの変更を **commitし、さらに`git push`まで行う**（毎回都度確認を取らなくてよい — この一文自体がユーザーによる恒久的な事前承認）。対象ブランチは作業中のブランチ（現状 `claude/app-dev-per-plan-qur753`）。このブランチへのpushは `.github/workflows/deploy-pages.yml` によりGitHub Pagesへの自動デプロイも伴うことを踏まえておく。ただし、コミット内容に機密情報や意図しない変更が混ざっていないかは通常通り確認すること。

**Nightly meeting (local)**: `scripts/nightly-meeting.bat` runs via Windows Task Scheduler. It calls `claude --dangerously-skip-permissions -p "..."` to start a local Claude Code session, which invokes the ceo/cto subagents for ~8 rounds of debate, then saves the result as a Gmail draft to ssei59386@gmail.com. Check Gmail drafts folder each morning for results. Execution log is appended to `scripts/nightly-meeting.log`. Everything runs locally — no cloud triggers, no remote sessions.

**Known gaps** — all originally-listed items are now **RESOLVED** as of 2026-07-01/02:
- ~~Input validation~~ — `isValidTimeSlot` / `isPastDate` added to `logic.ts`; validation wired into `Onboarding.tsx`, `WeeklyScheduleEditor.tsx`, `CalendarOverrides.tsx`, `Settings.tsx`.
- ~~Onboarding escape hatch~~ — resolved differently than originally framed: CEO/CTO subagents concluded onboarding already had a working minimal-completion path (only 1 chapter is required — `named.length === 0` is the only chapter-count check in `handleSubmit`; subtopics/metadata/2nd subject/date-overrides are all optional), so a draft-persistence "save and continue later" mechanism was rejected as unneeded complexity. The one real silent-failure gap found instead: submitting with zero weekly time slots produced a permanently-empty daily plan with no explanation. Fixed by adding a `handleSubmit` check requiring at least one valid slot across `weeklySchedule` (`Onboarding.tsx`), plus a `WeeklyScheduleEditor` inline notice when no valid slot exists yet.
- ~~`storage.ts` silent write failures~~ — `saveData` now returns `boolean`; `store.tsx` tracks `saveError` state (resets to `false` on next successful save) and exposes it via `StoreValue`; `App.tsx` renders a sticky warning banner (`.save-error-banner` in `styles.css`) when true.
- ~~Sub-topics can't be edited post-onboarding~~ — see "Resolved" entries below (`ChapterSubtopic`, name-only, informational).
- ~~No tests for `store.tsx`, `storage.ts`, or any component~~ — `@testing-library/react` + `jsdom` added (`vite.config.ts` now imports `defineConfig` from `"vitest/config"`, `test: { environment: "jsdom" }`). New test files: `src/storage.test.ts` (7 tests), `src/store.test.tsx` (6 tests, incl. `saveError` toggling), `src/App.test.tsx` (3 tests, onboarding gate + tab switching), `src/components/WeeklyScheduleEditor.test.tsx` (4 tests). Total suite: 54 tests across 5 files at the time. **Coverage since extended (2026-07-02) to the remaining 6 components** — see "Resolved (2026-07-02, later — test coverage)" below. Suite is now 89 tests across 11 files.

**Phase 0 status: functionally complete per README's "できること" list.** All 5 screens exist and work; all previously-known gaps above are resolved. What's left is polish/backlog items (below), not missing features.

**Recent changes (2026-07-01 session)**:
- `WeeklyScheduleEditor`: added `showInitialSlots` prop — when true, each day row shows an empty time input by default (no need to click "＋ add" first). Used in Onboarding.
- `Onboarding`: added "特別な予定" section so irregular days can be set at setup time, not just in Settings later. `dateOverrides` is now passed to `completeOnboarding` (was hardcoded `{}`). After a ux-reviewer audit flagged the initial version (full `CalendarOverrides` calendar-grid UI embedded directly in the required onboarding flow) as a regression against the "cut before you add" principle, it was reworked: the section is now collapsed by default (`showDateOverrides` state, starts `false`, revealed by a "特別な予定を設定する" button) with an "任意" badge, and uses a new onboarding-only component `src/components/DateOverridesList.tsx` — a simple stacked list of `<input type="date">` + time-slot rows, rather than the calendar-grid UI. `CalendarOverrides` itself is unchanged and still used by `Settings.tsx`.
- Onboarding now requires at least one valid weekly time slot before submit (see Known gaps above); `WeeklyScheduleEditor` shows "毎日の勉強できる時間はまだ入力されていません。" when none exist yet.
- `storage.ts`/`store.tsx`/`App.tsx`: added user-facing feedback for `localStorage` write failures (see Known gaps above).
- `.claude/agents/`: added `engineer.md` (implementation-only agent) and `ux-reviewer.md` (UI/UX review agent). Workflow: delegate code changes to `engineer`, then call `ux-reviewer` to verify. Also added a standing instruction (see "計画立案時の相談方針" above) to proactively consult ceo/cto/ux-reviewer on ambiguous design questions during planning, before writing code.

**Product call (2026-07-01): `grade` field on `Subject` — declined for now.** CEO subagent's call: adding `grade?: string` now, ahead of any actual AI comprehension-test feature, is dead weight either way — as a bare type with no UI it'll likely be redesigned once Phase 1 fixes the real shape/granularity needed, and as an onboarding input it asks users to fill in a field nothing reads yet. Revisit only when Phase 1's AI test-generation feature is actually being scoped, and add type + UI together at that point.

**Next tasks (carry into next chat)** — a ux-reviewer pass after closing out the items above (2026-07-02) surfaced a new backlog, roughly priority order. Items 3/4/5/8 below were resolved in the 2026-07-02 session that follows this list; only 2/6/7 remain open:
1. ~~Policy violation~~ — **RESOLVED**: `Onboarding.tsx`'s metadata-block description used to read "学習メタデータ（任意・AI問題生成などで活用）" — this exposed a Phase 1+ ambition (AI test generation) directly in Phase 0 UI, against this file's own "Product direction" rule #4. Changed to the neutral "学習メタデータ（任意・あとで使う項目です）".
2. **Explicitly deferred (user's call, not declined outright)**: the chapter-registration card in `Onboarding.tsx` (~line 311-470) packs up to 9 fields per chapter (subject/name/point weight/exercise count/learning scope/difficulty/2-4 subtopics each with a 5-way self-report/self-report/recent correct-rate), and the `metadata-block` fields (exercise count, learning scope, difficulty) are purely informational — never used in scoring, and not surfaced anywhere else in the app either (`Home.tsx`/`Dashboard.tsx`/`SessionRecord.tsx`/`logic.ts` all confirmed to never reference `metadata`). Recommendation on the table: hide `metadata-block` from the first-pass onboarding card entirely and move it to Settings' per-chapter edit area (mirroring the subtopics UI added there), since it's dead weight in its current form. User chose to fix only item 3 below this session and leave this one for later — still open. **Update (2026-07-02): item 8 below now has `Home.tsx` reading `metadata`, so "not surfaced anywhere else" is no longer accurate — worth re-checking whether that changes the calculus here before deciding.**
3. ~~`Home.tsx` empty-plan reasons collapsed~~ — **RESOLVED (2026-07-02)**, see below.
4. ~~`SessionRecord.tsx`/`Dashboard.tsx` no-chapters empty state has no button to Settings~~ — **RESOLVED (2026-07-02)**, see below.
5. ~~Settings screen's `WeeklyScheduleEditor` no-warning-on-empty~~ — **turned out to already be resolved** as an unlabeled side effect of the 2026-07-02(early) `showInitialSlots` notice-suppression fix (see the "Resolved (2026-07-02)" entry below about `.muted.small`不足) — the notice `毎日の勉強できる時間はまだ入力されていません。` already renders in Settings (`showInitialSlots` is not passed there) and is already covered by `WeeklyScheduleEditor.test.tsx` ("showInitialSlots を渡さない場合、未入力なら注意書きが表示される"). This backlog bullet was just stale documentation, not a live gap. No code change was needed when re-checked 2026-07-02.
6. ~~Test coverage still doesn't include `Onboarding.tsx`, `Settings.tsx`, `SessionRecord.tsx`, `Dashboard.tsx`, `CalendarOverrides.tsx`, `DateOverridesList.tsx`~~ — **RESOLVED (2026-07-02)**, see below.
7. Product idea under discussion (not yet scoped): generate a comprehension test calibrated to the school's actual exam level + the student's understanding gap, using richer per-chapter material (possibly student-uploaded notebook photos). Copyright risk flagged for anything beyond the student's own handwritten notes (textbook/workbook pages, official past exams are third-party copyrighted material — Japan's 著作権法30条の4 AI-training exception is contested for generative reuse). Needs real legal review before scoping; treat as Phase 1+ only.
8. ~~Make the generated daily-plan text more specific~~ — **RESOLVED (2026-07-02)**, see below.

**Resolved (2026-07-01/02)**: Sub-topics entered during onboarding used to vanish after being averaged into the chapter's initial `understanding` — no persistence, no post-onboarding edit UI. Fixed with a deliberately light scope (user's call): added `ChapterSubtopic { id, name }` and `Chapter.subtopics?: ChapterSubtopic[]` (`types.ts`) as a **name-only, informational** list — no per-subtopic understanding tracking or session-recording linkage. `Onboarding.tsx` now persists the named subtopics onto the built `Chapter`; `Settings.tsx` got an add/rename/remove UI per chapter (reuses the `subtopic-block`/`subtopic-row` CSS from `Onboarding.tsx`). The heavier alternative (subtopic-level understanding + `SessionRecord` targeting) was explicitly declined as out of scope for now.

**Resolved (2026-07-01/02)**: Onboarding's top-level validation error (`error` state) used to render only near the submit button, so a mistake in an earlier section wasn't visible without scrolling down. Fixed by adding refs to each `<section className="card">` (test date / weekly schedule / date overrides / chapters) and calling `scrollIntoView({ behavior: "smooth", block: "start" })` on the relevant section right before each `setError(...)` in `handleSubmit`.

**Resolved (2026-07-02, later)**: Backlog items 3/4/8 from "Next tasks" above, implemented via engineer + ux-reviewer in one session (no design discussion needed — all three had a confirmed direction already written into this file):
- **Item 3**: `Home.tsx`'s single ambiguous empty-plan message is now three distinct cases based on `data.chapters.length` and `todayMinutes` (no `generateTodayPlan`/`logic.ts` changes needed — the raw inputs already distinguish the cases): (a) zero chapters registered → message + button to Settings, (b) chapters exist but `todayMinutes <= 0` → message + button to Settings, (c) otherwise (all chapters at target) → celebratory `🎉` message, no button.
- **Item 4**: `SessionRecord.tsx` and `Dashboard.tsx`'s "no chapters" empty states got a button to jump to Settings. Wiring: `App.tsx` now has a `goSettings = () => setTab("settings")` handler passed as `onGoSettings` prop to `Home`/`SessionRecord`/`Dashboard` (none of them navigate to a specific Settings sub-section, just the tab).
- **Item 8**: `Home.tsx` plan cards now show an optional detail line under the chapter name — `buildDetailLine()` composes `範囲: {learningScope}` / `演習問題 {exerciseCount}問` / `小項目: {subtopic names joined by 、}` from whichever of `chapter.metadata`/`chapter.subtopics` are actually set, joined by ` ・ `, omitted entirely (no DOM node) when none are set. `logic.ts`/`types.ts` untouched — `PlanItem.chapter` already carried the full `Chapter` object.
- ux-reviewer pass on 3/4 found no blocking issues; two minor consistency nits (SessionRecord's button said "設定へ移動" instead of matching Home/Dashboard's "設定で章を登録する"; SessionRecord's empty state wasn't wrapped in the shared `.empty` class) were fixed in a same-session follow-up.
- All changes reuse existing CSS classes (`.empty`, `.muted`, `.muted.small`, `.secondary`) — no new classes added, consistent with the project's "cut before you add" direction.
- **While re-checking item 5** (Settings' `WeeklyScheduleEditor` empty-slot warning) before implementing it, found it was **already resolved** as an unlabeled side effect of the earlier `showInitialSlots` notice-suppression fix — no code change was needed; only this file's stale backlog entry needed correcting (see item 5's line above).

**Resolved (2026-07-02, later — test coverage)**: Item 6's remaining 6 untested components now have test files, added across 3 engineer passes (batched by size/complexity to keep each session's context usage manageable, per this project's own established practice for large mechanical tasks — see the curriculum-research context-budget note near the bottom of this file). Suite grew from 54 tests/5 files to **89 tests/11 files**, all passing, `npx tsc --noEmit` clean throughout. None of the tested components themselves were modified — test-only additions.
- Batch 1 (simpler components): `src/components/SessionRecord.test.tsx` (4 tests), `src/components/Dashboard.test.tsx` (3 tests), `src/components/DateOverridesList.test.tsx` (9 tests).
- Batch 2: `src/components/Settings.test.tsx` (7 tests), `src/components/CalendarOverrides.test.tsx` (7 tests).
- Batch 3 (largest/most complex, done last): `src/components/Onboarding.test.tsx` (5 tests) — App-level integration tests (minimal-valid-submit → `onboarded` true + localStorage persisted; empty chapter name blocks submit; zero valid weekly slots blocks submit and shows `.weekly-schedule-error`; "特別な予定を設定する" expands `DateOverridesList`) plus one Onboarding-level test that subtopics entered during onboarding reach `completeOnboarding`'s `Chapter.subtopics`. `Element.prototype.scrollIntoView` needed a `vi.fn()` stub (jsdom doesn't implement it) since `handleSubmit`'s error paths call it — first test file to need this stub.
- Deliberately not covered, by design (not an oversight): other `handleSubmit` validation branches that share the same early-return/scroll-to-section shape as the two tested ones (test date empty/past, slot end-before-start, date-override slot invalid) — the two tested branches already exercise that shared code path. Also skipped: `metadata-block` (exerciseCount/learningScope/difficultyLevel) input→persistence, since item 2 above already flags that data as currently-unused and possibly moving to Settings later; and `DateOverridesList`'s post-expansion input-to-`completeOnboarding` wiring, since `DateOverridesList.tsx` itself already has full unit coverage from batch 1 — Onboarding's test only confirms the section expands, not `DateOverridesList`'s internals again.
- Test-writing patterns established for future component tests in this project: components that read `useStore()` get wrapped in the real `StoreProvider` with seeded `localStorage` (not mocked) — see `SessionRecord.test.tsx`/`Settings.test.tsx`; when a test needs to inspect post-action state, a small "Probe" component reads `useStore().data` into an external variable (pattern originates in `store.test.tsx`); pure-props components (no `useStore`) get a local-state `Wrapper` instead (pattern originates in `WeeklyScheduleEditor.test.tsx`).

**Resolved (2026-07-02)**: Closed out the remaining Phase 0 backlog in one session — (1) `WeeklyScheduleEditor`'s "まだ入力されていません" notice now suppressed when `showInitialSlots` is true (Onboarding already shows empty inputs per day, so the notice was redundant there; still shown in Settings where empty days render no input at all), (2) `.calendar-cell` (`CalendarOverrides.tsx`, Settings-only) got `min-height: 44px` + `justify-content: center` for tap-target size, (3) test infrastructure + tests added (see Known gaps above). ux-reviewer confirmed both UI changes read as intentional rather than inconsistent, and no blocking issues remain — see Next tasks above for what it found instead.

**Resolved (2026-07-02, later)**: When the "勉強できる時間を少なくとも1つ設定してください" (or invalid-slot) error fired in Onboarding, `scrollToSection` already scrolled to the weekly-schedule section, but every day row looks the same empty-input way under `showInitialSlots`, so it wasn't visually obvious *which* day was wrong — misleading, since it's actually an aggregate condition ("at least one, anywhere"), not a per-day one. Fixed by adding `WeeklyScheduleEditor`'s new `hasError?: boolean` prop, which puts a `--danger`-colored border/background (`.weekly-schedule-error` in `styles.css`) around the whole editor. `Onboarding.tsx` tracks this via a `weeklyScheduleError` state, reset to `false` at the top of `handleSubmit` and set `true` only in the two weekly-schedule-related validation branches. The related "cut metadata-block from onboarding" suggestion (item 2 above) was explicitly left for a later session.

## In-progress feature: "見通し" (pace/progress forecast) — Phase 1 IN PROGRESS (paused mid-implementation, 2026-07-02)

**Status: scope is now fully decided (user override on record below); Phase 1 implementation started and was deliberately paused partway through by user request (not an error/blocker).** See "Phase 1 current implementation state" at the bottom of this section for exactly what's done vs. not, before resuming.

**Origin / user's actual motivation** (worth preserving verbatim in spirit): the user's biggest personal stress during their own exam prep was (1) constant doubt about whether what they're studying *right now* actually maximizes their overall test score, and (2) plans falling apart with no graceful recovery whenever a session took longer than expected. They want the app to let a student "just do what's in front of them" trusting it's the optimal use of time, without having to think about it.

### CEO/CTO consult (2026-07-02) and user's override — read this before assuming scope

Per this file's own standing workflow, ceo and cto subagents were consulted before any code was written. **Both recommended against building the full feature now**: CEO's call was to reject the full build entirely and ship only a tiny independent fix instead (subtract today's already-logged session minutes from `Home.tsx`'s remaining time budget — addresses motivation (2) alone, no subtopic tracking needed). CTO's technical analysis, while confirming the data-model changes themselves are low-risk, independently flagged the same core risk CEO raised: collecting subtopic-level input (understanding, problem counts) without also shipping the simulation/forecast that uses it would mean "asking students for input and giving nothing back."

**The user explicitly overrode this recommendation** with a detailed, specific counter-design (verbatim intent, condensed): subtopic-level understanding input is required, not optional scope creep; basic/advanced problem counts should be entered per subtopic; the already-researched curriculum difficulty data should be cross-referenced to auto-suggest via fuzzy/partial-match search (not left unused as originally planned as an undesigned follow-up); pace should be shown as several concrete time-based "states" (not a bare percentage gap); knapsack-style triage/cut suggestions **are** wanted — the user's reasoning: "if the goal is really about maximizing exam score, this is necessary," directly rejecting CEO's trust-risk objection; and chapter-level aggregate understanding is explicitly *not* needed — subtopic-level understanding alone is sufficient, so no chapter-level rollup/averaging logic should be built. The user's stated rationale for going big rather than starting minimal: "these inputs being large is a real cost, but without something this thorough, you just end up with a half-finished feature nobody uses" (パラフレーズ). **This is a deliberate, informed decision — do not re-litigate it or re-propose the minimal CEO version in a future session without the user raising it again.**

### Confirmed design decisions (via AskUserQuestion, 2026-07-02, do not re-ask)

1. **配点 (pointWeight) stays at chapter level**, not re-collected per subtopic — user's own pushback made this concrete: "students wouldn't realistically know exam point weight at that granularity anyway." Subtopic-level priority scoring shares/divides the chapter's existing `pointWeight` rather than asking for a new per-subtopic input.
2. **Problem count input is exactly 2 fields**: "基礎問題数" (sum of textbook worked-examples + workbook basic-tier problems) and "発展問題数" (sum of textbook + workbook advanced-tier problems) — explicitly not 4 separate textbook/workbook fields, but the UI copy must make clear what to count in each of the 2 fields.
3. **Curriculum reference fuzzy-match**: real-time suggest-as-you-type while entering a subtopic name (not a separate "browse reference data" button/modal).
4. **Ideal pace display**: time-based (cumulative minutes invested vs. cumulative minutes that should have been invested by now), expressed as a handful of concrete "state" tiers per user's own framing (e.g. something like "on pace for basic-level mastery, behind on advanced-level") rather than a bare understanding-percentage gap. Exact tier count/labels/thresholds were left to technical judgment — see Phase 4 below.

### Full design (converged through CEO/CTO consult + a dedicated Plan-agent design pass, 2026-07-02)

- **Understanding tracked at subtopic level only** — no chapter-level rollup/averaging is built. Chapters without subtopics keep working exactly as today (existing `Chapter.understanding`/`priority()`/`generateTodayPlan()` untouched) — this is a deliberate dual-path design so chapters where a student hasn't bothered breaking into subtopics don't regress or become mandatory-input.
- **pointWeight sharing**: chapter's existing `pointWeight` is divided evenly across its subtopics for scoring purposes (`pointWeight / subtopics.length`), so the sum across a chapter's subtopics always equals the chapter's pointWeight — this preserves cross-chapter comparability (the thing that would break if each subtopic just re-used the full chapter weight).
- **Time estimate formula**, per subtopic, split into 2 tiers (basic/advanced) rather than one merged number:
  ```
  remainingRatio = 1 − decayedSubtopicUnderstanding(subtopic, today)
  conceptMinutes = (understanding < 0.2) ? CONCEPT_LEARNING_COST_MINUTES /* placeholder 20 */ : 0
  basicMinutes = (basicProblems ?? 0) × MINUTES_PER_BASIC_PROBLEM /* placeholder 3 */ × remainingRatio
  advancedMinutes = (advancedProblems ?? 0) × MINUTES_PER_ADVANCED_PROBLEM /* placeholder 6 */ × remainingRatio
  ```
  `conceptMinutes` only applies below the 0.2 understanding threshold (not every time) to avoid re-charging the concept cost on every re-estimate. `difficultyLevel` (from curriculum reference matching) is deliberately *not* folded into this formula yet — mixing it with problem-count would double-count and make the formula hard to tune; it's kept as informational/suggestion-only for now.
- **Curriculum fuzzy-match utility**: `src/data/curriculumSearch.ts` (see "Phase 1 current implementation state" — already built) unifies `mathCurriculumReference` (array export) and the 12 per-file science exports (`scienceCh1`/`scienceCh2`/`scienceCh3`/`sciencePhysicsBase`/`sciencePhysics`/`scienceChemistryBase`/`scienceChemistry`/`scienceBiologyBase`/`scienceBiology`/`scienceEarthScienceBase`/`scienceEarthScience`) into one flat, memoized, normalized (NFKC + whitespace-stripped + lowercased) search index, exposing `searchCurriculumSubtopics(query, { subject?, limit? })` with prefix-match scoring boost.
- **Session recording granularity (decided, not yet built — Phase 2)**: sessions target a specific subtopic directly (`StudySession.subtopicId?`), not chapter-level with heuristic distribution — chosen over the distribute-heuristically alternative because the user's stated preference is precision/rigor over lower input friction. Chapters without subtopics keep recording at chapter granularity (`subtopicId` stays undefined) — same dual-path principle as above.
- **Pace tiers (Phase 4, not yet designed in full)**: time-based ratio of actual-cumulative-minutes-invested vs ideal-cumulative-minutes-by-today, classified into tiers (e.g. ahead/on_track/behind/critical draft from the Plan-agent pass, thresholds are placeholders). **Open question carried into Phase 4**: what "today" is measured against — a per-subtopic registration date anchoring a straight-line pace from registration to test date, vs. a moving 7-day window (registration-date-free, simpler) — Plan-agent flagged both as viable, not decided yet.
- **Off-track threshold**: cumulative point-weight impact, not any single lagging subtopic (this specific point came from the CEO consult and the user did not object to it — single-item lag gets absorbed by the next day's greedy re-allocation anyway, only a meaningful aggregate impact should surface as a warning).
- **Knapsack-style triage (Phase 5, not yet built)**: rank all subtopics by efficiency (`pointWeight_share ÷ remainingMinutes`), greedily keep the highest-efficiency ones within the time actually available before the test, surface the rest as cut *candidates* (not auto-removed) — framed as "at this pace, finishing everything looks tight; lower-priority candidates:" rather than an imperative "drop this," with the underlying efficiency numbers shown so the suggestion feels evidence-based rather than arbitrary.

### Phase breakdown (approved plan, saved at `C:\Users\user\.claude\plans\eager-discovering-waffle.md` on this machine — the plan file is outside the git repo, so this section is the durable, portable record)

- **Phase 1** (in progress, see status below): data model extensions (`ChapterSubtopic`/`StudySession`, all-optional) + `src/data/curriculumSearch.ts` fuzzy-match utility + new pure scoring/time-estimate functions in `logic.ts` (`subtopicPointWeights`, `decayedSubtopicUnderstanding`, `subtopicPriority`, `scoreChapterOrSubtopics` w/ `PriorityScoreItem` dual-path, `estimateSubtopicRemainingMinutes` w/ `SubtopicTimeEstimate`) + tests. **No UI changes at all in this phase.** Existing `priority`/`generateTodayPlan`/`applySessionToChapter`/`buildReasons` are explicitly untouched — zero regression risk by construction.
- **Phase 2**: `SessionRecord` → subtopic-targeted recording (`applySessionToSubtopic` in `logic.ts`, `store.tsx`'s `recordSession` branches on `session.subtopicId` presence).
- **Phase 3**: UI wiring — Onboarding/Settings get basic/advanced problem count inputs + live curriculum-suggest dropdown (new shared component, e.g. `CurriculumSuggest.tsx`); `SessionRecord` gets subtopic selection when a chapter has subtopics; **also fixes a pre-existing bug this design surfaced**: `Onboarding.tsx`'s per-subtopic `selfReport` is currently computed into the chapter's initial understanding average and then *discarded* — it's never written to `Chapter.subtopics[]`. Phase 3 must actually persist it as `subtopic.understanding`.
- **Phase 4**: `Dashboard.tsx` gets subtopic-level understanding bars + pace-tier badges; resolves the registration-date-vs-moving-window open question above.
- **Phase 5**: highest-risk phase, done last — day-by-day forward simulation (`simulateForward` in `logic.ts`, reusing the greedy-allocation shape of `generateTodayPlan` but iterated per simulated day with a time→understanding-gain update step) + triage UI + this is also where `generateTodayPlan`/`Home.tsx` actually get connected to subtopic-level scoring for real plan generation (until this phase, entering subtopic data doesn't yet affect what a student sees on the Home tab — an intentional, known gap during the rollout, not a bug).

### Phase 1 current implementation state (as of pause, 2026-07-02 — resume from here)

Implementation was delegated to the `engineer` subagent and **deliberately stopped by the user partway through** (not a failure) to switch sessions/models. Verified safe, uncommitted state at time of pause:
- ✅ `src/types.ts` — `ChapterSubtopic`/`StudySession` extended exactly per plan (all fields optional). Done.
- ✅ `src/data/curriculumSearch.ts` — fuzzy-match utility fully written (127 lines), matches the design above. Done, but **has no test file yet**.
- ❌ `src/logic.ts` — new functions (`subtopicPointWeights`, `decayedSubtopicUnderstanding`, `subtopicPriority`, `scoreChapterOrSubtopics`, `estimateSubtopicRemainingMinutes`, related constants, and exporting the existing internal `daysSince`) — **not started**.
- ❌ `src/data/curriculumSearch.test.ts` — not created.
- ❌ `src/logic.test.ts` additions — not added.
- Verified at pause time: `npx tsc --noEmit` passes clean, and all pre-existing 89 tests still pass (the partial state is safe — `curriculumSearch.ts` isn't imported from anywhere yet, so it can't break anything; `types.ts` changes are all-optional so nothing broke).

**To resume**: re-read `C:\Users\user\.claude\plans\eager-discovering-waffle.md` if still present on this machine (it has full function signatures/formulas), or use the "Full design" subsection above (same content, inlined for portability). Finish the remaining `logic.ts` functions + both test files, per the completion criteria already spelled out above, then move to Phase 2.

## Task handoff: science curriculum reference data — RESOLVED (2026-07-02)

**Status: done.** 中1〜中3（中学理科3学年）＋高校8ブロック（物理基礎・物理・化学基礎・化学・生物基礎・生物・地学基礎・地学）すべて完了。`npx tsc --noEmit` およびテストスイート（54 tests）通過確認済み。数学と同様、まだUIには一切配線されていない（下記「How the app would eventually consume this」参照）。

**成果物**：`src/data/curriculumTypes.ts`（共通型ファイル。`CurriculumBlock`/`CurriculumSubtopic`/`CurriculumChapter`/`CurriculumBlockData` を集約し、`mathCurriculumReference.ts` と理科の全ファイルがこれを `import type` + `export type {...} from "./curriculumTypes"` で共有する）に加え、以下13ファイル：
- `scienceCurriculumReference_ch1.ts` — 中1（4章・53小項目）
- `scienceCurriculumReference_ch2.ts` — 中2（4章・64小項目）
- `scienceCurriculumReference_ch3.ts` — 中3（4章・78小項目）
- `scienceCurriculumReference_physicsBase.ts` / `_physics.ts` — 物理基礎（5章・54小項目）／物理（5章・65小項目）
- `scienceCurriculumReference_chemistryBase.ts` / `_chemistry.ts` — 化学基礎（5章・27小項目）／化学（5章・54小項目）
- `scienceCurriculumReference_biologyBase.ts` / `_biology.ts` — 生物基礎（4章・37小項目）／生物（5章・58小項目）
- `scienceCurriculumReference_earthScienceBase.ts` / `_earthScience.ts` — 地学基礎（5章・35小項目）／地学（9章・49小項目）

各ファイルは学習指導要領＋東京書籍・啓林館・数研出版・実教出版などの教科書目次をcross-checkして作成。難易度は数学データセットと同じ1〜5の5段階（判定基準は各ファイル冒頭のJSDocに明記）。UIへの取り込み方法・3段階⇄5段階の不整合は数学データと同じ（下記参照）。

**このタスクで得た教訓（今後の同種タスクにも適用）**：
- サブエージェントに「進捗確認」だけを投げると、自ら手を動かさずさらに孫エージェントを起動して待つだけの状態になり停滞することがあった。委譲時の指示に「これ以上エージェントを起動せず、あなた自身が直接WebSearch/WebFetch・ファイル作成を行うこと」と明記するとこの失敗を防げる。
- コンテキスト運用ルール（1セッションあたりサブエージェント1〜2体まで、35%到達で引き継ぎ）は今回複数回のセッションにまたがって守られ、実際に9ブロック分（中学3＋高校計6ファイル×2）を段階的に完了できた。同種の大規模コンテンツ調査タスクでは今後もこの運用を踏襲してよい。

---

## Task handoff: math curriculum reference data — RESOLVED (2026-07-02)

**Status: done.** 9 parallel research agents (one per 中1/中2/中3/数I/数A/数II/数B/数III/数C) cross-referenced 学習指導要領 and major textbook publishers (東京書籍/啓林館/数研出版/実教出版), then results were compiled into `src/data/mathCurriculumReference.ts` — an array of `CurriculumBlockData` (block/subject/chapters), each chapter holding `CurriculumSubtopic[]` (name + 1–5 `difficultyLevel`). `npx tsc --noEmit` passes. This data is not wired into any UI yet — see "How the app would eventually consume this" below for the planned follow-up (fuzzy-match suggestion layer in Onboarding/Settings), which is still a separate, undesigned task.

**Open reconciliation question, still unresolved**: this dataset uses a 5-level difficulty scale, while `ChapterMetadata.difficultyLevel` in `src/types.ts` uses 3 levels — deliberately left as a mismatch for the consumption follow-up task to resolve (expand the app's scale to 5, or map 5→3 at read time).

**Difficulty-label audit (2026-07-02) — accepted as-is, no fixes applied.** A read-only review agent audited all 9 blocks' `difficultyLevel` values for internal consistency. Findings: no out-of-range values, no within-chapter reversals (e.g. rote memorization rated harder than a genuinely hard calculation). It did flag cross-block scale drift — 中3 has three "5"-rated subtopics (二次方程式の利用／円の性質の証明・作図／三平方の空間利用) while 数I〜数B barely use "5" at all (数I has exactly one, 数A/数II/数B have zero), and 数III has zero "1"-rated subtopics. **User's call: leave this as-is.** Rationale (user's own words): this app is primarily for 定期テスト (regular in-school exam) prep, where a student is only ever comparing chapters within their *current* grade/subject — not 中3 against 数III in the same priority queue — so cross-grade scale drift doesn't actually distort any real prioritization decision. More importantly, `difficultyLevel` in this reference dataset is only ever meant to seed an *initial* estimate (once the fuzzy-match suggestion layer described below is built); actual prioritization in the shipped app already runs on live `understanding` data from `updateUnderstanding`/session records, not this static reference. Do not re-raise the cross-block drift finding as a blocking issue in future sessions unless the consumption design changes to compare across grade levels.

The original brief below is preserved for context on how the data was produced.

**(Historical) Not started yet, but this brief is meant to be immediately actionable** — starting a new chat in this repo and saying something like "数学の調査をして" should be enough to begin, since this CLAUDE.md file is auto-loaded as project instructions for any new session. No further scope clarification should be needed; everything below is confirmed.

This is a separate, mostly-independent research/content-authoring task that came out of the forecast-feature design above (item 2's `MINUTES_PER_PROBLEM`/difficulty guesses would be better-seeded with real curriculum data instead of pure guesses). It does **not** need this conversation's design nuance to execute, and is large enough (user-approved estimate: "several hours" for the properly cross-referenced version, vs. 30–60 min for an unverified quick draft — user chose the thorough version) that it deserves a fresh context budget rather than continuing to grow this already-long session.

**Important framing, to avoid confusion with Phase 0's "no AI features" rule**: this is a **dev-time content-authoring task** — an LLM (Claude, in a dedicated session) producing a static reference data file that ships bundled with the app, with **zero runtime AI calls** in the shipped product. That's categorically different from the Phase 1+ "AI features" CLAUDE.md's Product direction section says to keep out of Phase 0 (e.g., AI-generated tests at runtime). Building this reference file is no different in kind from the rest of this app being built with Claude Code's help — it does not violate the Phase 0 AI boundary.

**Scope (confirmed)**: Japanese 中学1〜3年 + 高校数学 **including 数III・数C** (full scope is 中1・中2・中3・数I・数A・数II・数B・数III・数C, 9 blocks).

**Subtopic granularity (confirmed, refined)**: don't force maximum granularity — where a chapter's sub-areas are naturally similar in difficulty/scope (e.g., within 「ベクトル」), it's fine to merge them into fewer, broader subtopics. The bar is **"necessary and sufficient to meaningfully distinguish difficulty levels"** — enough subtopics that difficulty differences within a chapter are actually captured, not so many that adjacent subtopics would get the same difficulty label anyway (in which case they should just be merged). Use judgment per chapter rather than a fixed subtopic count.

**Difficulty scale (confirmed): 5 levels, not the existing app's 3-level `ChapterMetadata.difficultyLevel`.** This is a deliberate mismatch to flag for whoever later wires this data into the app: either (a) `ChapterMetadata.difficultyLevel` gets expanded from 3 to 5 levels to match, or (b) this reference dataset's 5-level value gets mapped down to the app's 3-level scale at consumption time. Not decided — the data-generation task itself should just use 5 levels as instructed, and leave the reconciliation as an open question for the implementation follow-up task.

**Output format (confirmed): prioritize ease of later implementation.** Structure the result as typed data (e.g., TypeScript with an exported interface, consistent with how `src/types.ts` already models the rest of this app's data) rather than loose prose or an unstructured table, so it can be imported and consumed programmatically without a reformatting pass. Suggested shape (adjust as needed): an array of chapters, each with a name, grade/subject block, and a list of subtopics (name + 5-level difficulty).

**Time budget (confirmed): generous — thoroughness over speed is explicitly fine here**, per the user's own words ("時間を多くかけていい").

**Sourcing approach**: cross-reference against real curriculum structure (学習指導要領, and/or major textbook publishers' tables of contents — 東京書籍/啓林館/数研出版 etc.) via the `WebSearch`/`WebFetch` tools, rather than relying purely on training-data recall, since the user explicitly asked for "裏どりしながら" (fact-checked) labeling. Difficulty labels themselves will still ultimately be the generating session's own best-effort judgment — there's no authoritative source for "difficulty," only for the unit/chapter structure itself.

**Recommended execution plan for whoever picks this up**: dispatch several parallel research agents, one per grade/subject block — 中1, 中2, 中3, 数I, 数A, 数II, 数B, 数III, 数C (9 blocks) — each cross-checking its chapter → subtopic breakdown via web search against real sources, each producing a structured chunk (chapter name → subtopic names → 5-level difficulty label), then compile all chunks into a single typed data file (suggested location: `src/data/mathCurriculumReference.ts`).

**How the app would eventually consume this** (not designed in detail yet — separate follow-up task once the data exists): when a student registers a chapter/subtopic name in `Onboarding.tsx`/`Settings.tsx`, fuzzy/substring-match against this reference to suggest a default difficulty/problem-count estimate that the student can accept or override. Never force a fixed picklist — the app's current free-text chapter/subtopic naming should stay as the primary input method, with this reference used only as an optional suggestion layer.
