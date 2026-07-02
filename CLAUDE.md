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
1. ~~Policy violation~~ — **RESOLVED**: `Onboarding.tsx`'s metadata-block description used to read "学習メタデータ（任意・AI問題生成などで活用）" — this exposed a Phase 1+ ambition (AI test generation) directly in Phase 0 UI, against this file's own "Product direction" rule #4. Changed to the neutral "学習メタデータ（任意・あとで使う項目です）".
2. **Explicitly deferred (user's call, not declined outright)**: the chapter-registration card in `Onboarding.tsx` (~line 311-470) packs up to 9 fields per chapter (subject/name/point weight/exercise count/learning scope/difficulty/2-4 subtopics each with a 5-way self-report/self-report/recent correct-rate), and the `metadata-block` fields (exercise count, learning scope, difficulty) are purely informational — never used in scoring, and not surfaced anywhere else in the app either (`Home.tsx`/`Dashboard.tsx`/`SessionRecord.tsx`/`logic.ts` all confirmed to never reference `metadata`). Recommendation on the table: hide `metadata-block` from the first-pass onboarding card entirely and move it to Settings' per-chapter edit area (mirroring the subtopics UI added there), since it's dead weight in its current form. User chose to fix only item 3 below this session and leave this one for later — still open.
3. `Home.tsx` (~line 33-36) collapses two different empty-plan reasons ("all chapters already at target" vs. "zero available minutes today") into one ambiguous message; they call for different user action (celebrate vs. fix availability settings) and `generateTodayPlan`'s inputs already distinguish them.
4. `SessionRecord.tsx` (~line 46-52) and `Dashboard.tsx` (~line 35) both have a "no chapters yet" empty state that's text-only, no button to jump to Settings (tab bar is always visible so not a dead end, just an extra tap).
5. Settings screen's `WeeklyScheduleEditor` (no `showInitialSlots`) allows saving with all weekly slots removed/empty with no warning, silently producing a permanently-empty Home plan (same class of issue as the now-fixed Onboarding gap, just not gated since Settings changes save immediately rather than going through a single submit step). Consider a lightweight non-blocking notice, not a hard validation block.
6. Test coverage still doesn't include `Onboarding.tsx`, `Settings.tsx`, `SessionRecord.tsx`, `Dashboard.tsx`, `CalendarOverrides.tsx`, `DateOverridesList.tsx` — the two-part test-infra work above only covered `storage.ts`/`store.tsx`/`App.tsx`/`WeeklyScheduleEditor.tsx`.
7. Product idea under discussion (not yet scoped): generate a comprehension test calibrated to the school's actual exam level + the student's understanding gap, using richer per-chapter material (possibly student-uploaded notebook photos). Copyright risk flagged for anything beyond the student's own handwritten notes (textbook/workbook pages, official past exams are third-party copyrighted material — Japan's 著作権法30条の4 AI-training exception is contested for generative reuse). Needs real legal review before scoping; treat as Phase 1+ only.
8. Related idea (not yet scoped): make the generated daily-plan text more specific (e.g. page ranges, which subtopic to focus on) by surfacing the already-collected `ChapterMetadata.learningScope`/`exerciseCount` and `Chapter.subtopics` names in `generateTodayPlan`'s output, instead of just the chapter name. Deliberately keep new required onboarding fields to zero; prefer surfacing what's already collected.

**Resolved (2026-07-01/02)**: Sub-topics entered during onboarding used to vanish after being averaged into the chapter's initial `understanding` — no persistence, no post-onboarding edit UI. Fixed with a deliberately light scope (user's call): added `ChapterSubtopic { id, name }` and `Chapter.subtopics?: ChapterSubtopic[]` (`types.ts`) as a **name-only, informational** list — no per-subtopic understanding tracking or session-recording linkage. `Onboarding.tsx` now persists the named subtopics onto the built `Chapter`; `Settings.tsx` got an add/rename/remove UI per chapter (reuses the `subtopic-block`/`subtopic-row` CSS from `Onboarding.tsx`). The heavier alternative (subtopic-level understanding + `SessionRecord` targeting) was explicitly declined as out of scope for now.

**Resolved (2026-07-01/02)**: Onboarding's top-level validation error (`error` state) used to render only near the submit button, so a mistake in an earlier section wasn't visible without scrolling down. Fixed by adding refs to each `<section className="card">` (test date / weekly schedule / date overrides / chapters) and calling `scrollIntoView({ behavior: "smooth", block: "start" })` on the relevant section right before each `setError(...)` in `handleSubmit`.

**Resolved (2026-07-02)**: Closed out the remaining Phase 0 backlog in one session — (1) `WeeklyScheduleEditor`'s "まだ入力されていません" notice now suppressed when `showInitialSlots` is true (Onboarding already shows empty inputs per day, so the notice was redundant there; still shown in Settings where empty days render no input at all), (2) `.calendar-cell` (`CalendarOverrides.tsx`, Settings-only) got `min-height: 44px` + `justify-content: center` for tap-target size, (3) test infrastructure + tests added (see Known gaps above). ux-reviewer confirmed both UI changes read as intentional rather than inconsistent, and no blocking issues remain — see Next tasks above for what it found instead.

**Resolved (2026-07-02, later)**: When the "勉強できる時間を少なくとも1つ設定してください" (or invalid-slot) error fired in Onboarding, `scrollToSection` already scrolled to the weekly-schedule section, but every day row looks the same empty-input way under `showInitialSlots`, so it wasn't visually obvious *which* day was wrong — misleading, since it's actually an aggregate condition ("at least one, anywhere"), not a per-day one. Fixed by adding `WeeklyScheduleEditor`'s new `hasError?: boolean` prop, which puts a `--danger`-colored border/background (`.weekly-schedule-error` in `styles.css`) around the whole editor. `Onboarding.tsx` tracks this via a `weeklyScheduleError` state, reset to `false` at the top of `handleSubmit` and set `true` only in the two weekly-schedule-related validation branches. The related "cut metadata-block from onboarding" suggestion (item 2 above) was explicitly left for a later session.

## In-progress design: "見通し" (pace/progress forecast) feature — NOT implemented yet

**Status: pure design conversation only, nothing in this section has been built.** Do not implement any of it without re-confirming scope with the user — this is a large feature bundle, easily bigger than any single change made in this file's history so far, and several open questions below are still unresolved. This section exists purely so the thread isn't lost across sessions.

**Origin / user's actual motivation** (worth preserving verbatim in spirit): the user's biggest personal stress during their own exam prep was (1) constant doubt about whether what they're studying *right now* actually maximizes their overall test score, and (2) plans falling apart with no graceful recovery whenever a session took longer than expected. They want the app to let a student "just do what's in front of them" trusting it's the optimal use of time, without having to think about it.

**Concrete gaps confirmed in the current code that map to those two anxieties:**
- No forward-looking confidence signal exists anywhere — `buildReasons` in `logic.ts` only gives after-the-fact labels ("配点が高め" etc.), never "are you on pace to hit target by test day."
- `Home.tsx`'s `todayMinutes` is *always* the full day's `availableMinutesForDate(data.availability, today)` — it has **no memory of minutes already spent today** via sessions already logged. If a session runs long, the app has no way to know the day's remaining budget shrank; it just re-offers a plan as if the whole day's time were still available.

**Design that's converged so far (in conversation, still needs implementation planning):**

1. **Track understanding per subtopic, not just per chapter — this reverses the "light scope" subtopics decision from earlier in this same session** (see the "Resolved (2026-07-01/02)" entry above: `ChapterSubtopic` was deliberately kept name-only/informational, and the heavier "subtopic-level understanding + session targeting" alternative was explicitly declined at the time). The user has now decided that heavier version *is* needed for this forecast feature. Each subtopic would get its own 5-point self-report (reuse `INITIAL_UNDERSTANDING_LABELS`). **Open question, unresolved**: how does chapter-level `understanding` get derived from its subtopics — simple average, or weighted by problem count?

2. **Per-subtopic time-to-close-gap estimate, using concrete problem counts instead of the abstract `ChapterMetadata.difficultyLevel`** (which the user found too vague/hard to reason about). Plan: add two new per-subtopic fields — number of textbook practice problems, number of workbook (問題集) practice problems. Draft formula (all constants are placeholders to tune later, same spirit as `SESSION_MINUTES`/`FORGETTING_HALF_LIFE_DAYS`):
   ```
   conceptTime = (selfReportLevel === 1 /* 解いたことがない */) ? CONCEPT_LEARNING_MINUTES /* ~15–20分 */ : 0
   practiceTime = (textbookProblems + workbookProblems) × (1 − subtopicUnderstanding) × MINUTES_PER_PROBLEM /* placeholder ~3分 */
   subtopicMinutesNeeded = conceptTime + practiceTime
   ```
   Rationale for `conceptTime`: the existing 5-point scale's rung 2 ("解説を読めば分かる") already functions as a "do you understand the textbook explanation" checkpoint, so rung 1 gates a flat textbook-reading-comprehension time cost that a pure problem-count formula would otherwise miss entirely.

3. **Self-calibration from real session data, replacing the fixed placeholder constants over time** (same exponential-smoothing spirit as `updateUnderstanding`). **Requires a new field on `StudySession`: number of problems completed in that session** (not currently tracked — today's session only has chapter, minutes, correctRate, selfReport). **Open question, unresolved**: does `SessionRecord` need to target a specific subtopic (bigger UI change to that screen), or can problems-completed be logged at chapter granularity and distributed heuristically across its subtopics?

4. **Day-by-day forward simulation to detect "won't make it in time" chapters/subtopics, reusing `generateTodayPlan`'s existing greedy-allocation logic run repeatedly from today through each subject's test date** (rather than computing each subject's forecast independently) — this is deliberately how the shared daily-time-pool competition between math and science gets handled correctly, for free, since the simulation just runs the same greedy priority allocation each simulated day across both subjects' remaining chapters. At each subject's test date within the simulation, anything with remaining `minutesNeeded > 0` is flagged off-track.

5. **Concrete alternative plan when off-track (not just a warning)**: re-rank flagged items by efficiency (`pointWeight ÷ minutesNeeded`) and suggest explicitly dropping/deprioritizing the lowest-efficiency ones so higher-value chapters still fit in the remaining time — a knapsack-style triage. Also want a "won't finish all practice problems at this pace" warning, which falls out of the same mechanic once problem-count-based estimates exist.

**Other open questions, not yet resolved:**
- Where does the forecast surface in the UI — Dashboard (opt-in, lower pressure) vs. Home (always visible, matches the "just trust it and go" goal but risks being anxiety-inducing itself)?
- What's the "off-track" threshold — any single lagging chapter, or only above some cumulative point-weight impact?
- This project's own standing workflow (see "計画立案時の相談方針" above) calls for a ceo/cto consult before implementing ambiguous-scope work like this — **not yet done**. Strongly recommended before writing any code for this feature, given its size relative to everything else built in Phase 0 so far.

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
