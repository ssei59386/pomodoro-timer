# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**This file is kept intentionally lean** — it's auto-loaded as project instructions for every new session, so it holds only durable architecture/workflow facts plus short pointers to detailed history. Full phase-by-phase implementation logs, ux-reviewer findings, and design-debate transcripts live in `docs/` instead (see "Current status" below for which file covers what). When a feature's detailed history grows large, split it into `docs/` the same way rather than letting it accumulate here.

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
- `Chapter` — the unit of understanding tracking. Holds `understanding` (0.0–1.0), `targetUnderstanding` (default 0.8), `lastStudiedDate`, optional `metadata` (exercise count, learning scope, difficulty — informational, not used in scoring), and optional `subtopics` (see below). (`pointWeight` was removed 2026-07-07 — see `docs/pointweight-removal-2026-07-07.md`.)
- `ChapterSubtopic` — a chapter can optionally be broken into subtopics, each independently tracking `understanding`, `basicProblems`/`advancedProblems` (target problem counts), `teacherHinted` (priority boost), etc. Chapters without subtopics keep working exactly as they did in Phase 0 (dual-path design throughout `logic.ts`) — see `docs/feature-mitoshi.md` for the full design.
- `StudySession` — a logged study session (chapter or subtopic, minutes, correctRate, selfReport, problem counts) that drives understanding updates.
- `AvailabilitySettings` — weekly recurring time slots (`weeklySchedule`, keyed by day-of-week 0–6) plus `dateOverrides` for one-off days (e.g. travel). This indirection is deliberate: a future calendar integration would only need to replace the input source, since plan generation always asks "how many minutes available on date X" via `availableMinutesForDate`.

**Core algorithms** (`src/logic.ts`):
- Understanding update (§6.1): `observed = 0.7×correctRate + 0.3×(selfReport/5)`, then exponentially smoothed: `understanding_new = 0.5×observed + 0.5×understanding_old`. Constants: `OBSERVED_CORRECT_WEIGHT`, `OBSERVED_SELF_WEIGHT`, `SMOOTHING_ALPHA`.
- Initial understanding (no sessions yet): self-report alone, or blended with a known recent correct-rate via `computeInitialUnderstanding`. If a chapter was broken into 2–4 sub-topics during onboarding, `averageInitialUnderstanding` averages their self-reports instead.
- Forgetting decay: `decayedUnderstanding(chapter, today)` exponentially decays `chapter.understanding` based on days since `lastStudiedDate`, half-life `FORGETTING_HALF_LIFE_DAYS = 21`. This is a **read-time-only** calculation — the stored `understanding` value itself is never mutated by decay. All scoring (`priority`) uses the decayed value, not the raw stored one. `decayedSubtopicUnderstanding` is the subtopic-level equivalent.
- Priority score (§6.2): `priority = max(target − decayedUnderstanding, 0) × proximity` (no point-weight multiplier — removed 2026-07-07, since students can't actually know a chapter's exam point weight for a school's 定期テスト), where `proximity = 1 / daysLeft(testDate)`. `subtopicPriority` is the subtopic-level equivalent (same formula, applies a `teacherHinted` boost). `scoreChapterOrSubtopics` dual-paths between the two.
- Plan generation (§6.3, `generateTodayPlan`): greedy allocation — sort chapters/subtopics by priority descending (via `scoreChapterOrSubtopics`), filter out items already at/above target (score ≤ 0), then consume `dailyMinutes` one item at a time. Chapters without subtopics get a fixed `SESSION_MINUTES` (45 min) allocation, one per day (unchanged from Phase 0). Chapters with subtopics can contribute multiple items per day, each clamped between `MIN_SUBTOPIC_SESSION_MINUTES` (10 min) and `SESSION_MINUTES`, sized from `estimateSubtopicRemainingMinutes`'s time estimate. `buildReasons`/`buildSubtopicReasons` attach human-readable justification labels (理解度が低め / テストが近い / 先生のヒントあり) for display.
- Time estimation (`estimateSubtopicRemainingMinutes`): per-subtopic remaining study time from basic/advanced problem counts and current understanding gap, using either default per-problem-minute constants or a per-subject *learned* rate (`learnedProblemRates`) once enough real session data exists.
- Pace judgment (`subtopicUnderstandingTier`/`subtopicProblemTier`): achievement-based (not time-invested-based) "on_track / slightly_behind / at_risk" classification per subtopic, shown on the Dashboard.
- Study history (`buildStudyHistory`, added 2026-07-07): pure function returning the last 7 days (rolling window including today, gap-free — zero-session days included as 0 minutes) of daily total study minutes + per-session detail (subject/chapter/subtopic name, minutes), resolved from `chapterId` → `Chapter` → `subjectId` → `Subject`. Rendered at the top of the Dashboard as a bar chart (today highlighted, tap a bar to expand that day's session list). Vocab (`VocabChunk`) isn't included — it doesn't track time.

**Screens** (`src/App.tsx` tab router, gated by `data.onboarded`): Onboarding → Home (today's plan) → SessionRecord → Dashboard (understanding vs. target, days left, pace badges) → Settings (edit/reset). `Onboarding.tsx` is also where subjects, chapters, initial self-reports, sub-topics, and optional metadata are entered; it's the most complex form in the app.

**Today's plan snapshot / freeze (added 2026-07-05):** `Home.tsx` no longer shows whatever `generateTodayPlan` returns live on every render. `AppData.todayPlan` (`{ date, itemKeys: {chapterId, subtopicId}[] } | null`) freezes *which* chapters/subtopics are today's target set the first time Home is opened that day (`store.tsx`'s `ensureTodayPlan`, called from a `Home.tsx` `useEffect`, is a no-op if a same-date snapshot already exists). `logic.ts`'s `buildPlanFromItemKeys(chapters, subjects, itemKeys, today, sessions)` re-derives display data (`allocatedMinutes`/`reasons`/`priority`) fresh from current chapter data every render — only the *set* of items is frozen, not their displayed numbers, so editing a chapter in Settings still updates its reason chips same-day. This exists because completing an item used to free up its time budget and immediately pull in the next-best chapter, so the list never visibly finished ("無限に出てくる" — user-reported). Completion is derived, not stored: an item counts as done if `data.sessions` has a same-day session for its chapterId(+subtopicId); no `completed` flag anywhere. Vocab/memorization cards are NOT part of this freeze — they stay live every render (deliberate: an intentional "escape valve" for students who finish early, per ux-reviewer).

**PWA/deploy specifics** (`vite.config.ts`): `base` is `/` in dev but switches to `/pomodoro-timer/` on build, because the GitHub Pages workflow (`.github/workflows/deploy-pages.yml`) serves this as a project site. That workflow deploys on push to `master` or `claude/app-dev-per-plan-qur753`. `actions/deploy-pages@v4`が一時的なエラーで失敗することが稀にある（空コミットでリトライすれば通る）ので、push後は本番URLの反映を確認し、deployだけ失敗していたら空コミットでリトライすること。

**Forward-compat note in storage:** `loadData()` spreads `initialData` under any parsed/stored data so newly added fields get sane defaults for users with older persisted state — preserve this pattern when adding fields to `AppData`/`Chapter`.

**実装上の既知の注意点（繰り返し踏んだ罠）：**
- `<details>/<summary>`のネイティブ開閉は、Playwrightの合成クリック/タップに反応しないことがある（キーボードでは動く）。アコーディオンUIは`useState` + `<button>`で実装する（詳細: `docs/mobile-polish-2026-07-06.md`）。
- 数値inputで`onChange`のたびに`Math.max(min, ...)`をその場適用すると、ユーザーが値を消そうとしても即座に最小値へ強制されて消せなくなる。入力中は空文字列を許容し、保存時にのみ補正すること（`SessionRecord.tsx`のminutesで実機発見、他の数値inputへの横展開チェックは未実施）。

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

**ワークフロー：** ユーザーから実装タスクを受けたら、engineer エージェントに詳細仕様を渡して委譲する。実装が終わったら ux-reviewer エージェントを呼んで品質確認する。CEO/CTO は夜間会議および製品方向性の判断に使う。実装後は実際に `npm run dev` で動かして（可能なら Playwright で）目視確認する — 型チェック・テスト・コードレビューだけでは見えないUI不具合が繰り返し見つかっているため（詳細は `docs/feature-mitoshi.md` の "Takeaway for future phases" 等を参照）。

**計画立案時の相談方針：** 実装計画を立てる段階で、UI設計の選択肢（例：カレンダーUI vs. シンプルな日付入力）や優先順位判断など、答えが自明でない論点が出たら、コードを書き始める前に該当する専門サブエージェント（ux-reviewer / ceo / cto）に具体的な質問を投げて意見を仰ぐ。ユーザーに都度判断を仰ぐ前に、まずサブエージェントの見解を集めてから選択肢を絞り込む。

**セッション引き継ぎ時のcommit/push方針（ユーザー指定、2026-07-02）：** ユーザーから「引き継ぎをして」「新しいチャットに行く」など、セッションの区切り・引き継ぎを依頼された場合、CLAUDE.md等への引き継ぎ内容の記録に加えて、その時点までの変更を **commitし、さらに`git push`まで行う**（毎回都度確認を取らなくてよい — この一文自体がユーザーによる恒久的な事前承認）。対象ブランチは作業中のブランチ（現状 `claude/app-dev-per-plan-qur753`）。このブランチへのpushは `.github/workflows/deploy-pages.yml` によりGitHub Pagesへの自動デプロイも伴うことを踏まえておく。ただし、コミット内容に機密情報や意図しない変更が混ざっていないかは通常通り確認すること。

**Nightly meeting (local)**: `scripts/nightly-meeting.bat` runs via Windows Task Scheduler. It calls `claude --dangerously-skip-permissions -p "..."` to start a local Claude Code session, which invokes the ceo/cto subagents for ~8 rounds of debate, then saves the result as a Gmail draft to ssei59386@gmail.com. Check Gmail drafts folder each morning for results. Execution log is appended to `scripts/nightly-meeting.log`. Everything runs locally — no cloud triggers, no remote sessions.

## Current status (2026-07-03)

**Phase 0: functionally complete.** All 5 screens exist and work; all originally-known gaps are resolved. Full history (input validation, onboarding escape hatch, save-error banner, subtopic editing, test coverage buildout — 89 tests reached at the end of that work) is in **`docs/phase0-history.md`**.

Still-open backlog items from that history (not yet scoped/resolved, low priority):
- Onboarding's chapter-registration card is dense (up to 9 fields per chapter); moving the purely-informational `metadata-block` (exercise count/learning scope/difficulty) to Settings-only has been suggested twice by ux-reviewer but deliberately deferred both times. Revisit next time Onboarding's form load is reconsidered.
- Product idea (not scoped): AI-generated comprehension tests calibrated to the school's exam level. Copyright risk flagged for anything beyond the student's own handwritten notes — needs real legal review before scoping. Phase 1+ only, do not build UI for this in Phase 0.

**"見通し" (pace/progress forecast) feature: Phase 1〜6 COMPLETE — functionally complete.** This is the current major feature — subtopic-level understanding/pace tracking, curriculum-data-backed suggestions, subtopic-level daily plan generation (Phase 4.5), day-by-day forward simulation + knapsack triage of cut-candidates on the Dashboard (Phase 5), and (as of Phase 6) that same simulation now also drives `generateTodayPlan` itself for chapters with or without subtopics — items unlikely to finish in time are deprioritized (spillover: they still get any leftover time budget, never a hard exclusion) rather than just shown as Dashboard-only information, and a learned per-subject pace multiplier adjusts the time-remaining estimates. Full design history, confirmed decisions (do not re-ask), and phase-by-phase implementation logs are in **`docs/feature-mitoshi.md`** — **read this file before resuming work on this feature**, it contains decisions that should not be re-litigated (e.g. the user's explicit override of a CEO/CTO recommendation to build a minimal version instead). Test suite: **344 tests** as of the pointWeight-removal session (2026-07-07) — run `npm test` to confirm nothing regressed before continuing. On-device visual QA via Playwright + Chromium **was done** in the 2026-07-06 mobile-polish session (see `docs/mobile-polish-2026-07-06.md`) — browser automation availability is environment-dependent per session, try early rather than assuming it's unavailable. The write-back "今回は捨てる/exclude-from-plan" manual toggle remains deliberately not built (fully automatic only).

**Curriculum reference data (math + science): RESOLVED, both fully built and integrated** into the "見通し" feature's suggestion layer (`src/data/curriculumSearch.ts`). Full research-task history is in **`docs/curriculum-data.md`**.

## セッション引き継ぎメモ（2026-07-07、学習履歴セクション追加＋配点撤廃セッション終了時点）

**オンボーディングの本格ウィザード化は完了済み**（実装内容・残りのUXバックログは `docs/feature-onboarding-wizard.md` 参照）。

**このセッションでやったこと・詳細は `docs/pointweight-removal-2026-07-07.md` を読むこと。** 要点のみここに残す:

- Dashboardに「学習履歴」セクション（直近7日間の日別学習時間を棒グラフ表示、タップで内訳展開）を追加（`buildStudyHistory`、上記Core algorithms参照）。commit `806db2a`。
- 配点(pointWeight)機能を完全撤廃。優先度は理解度不足×テストの近さのみで決定、「切る候補」も残り所要時間が長い順に変更。ceoとの2回の議論（1回目は3択セレクトへの妥協案→ユーザーの再反論を受けて2回目で完全撤廃に転換）と、CTO提案の実装方式に自分で見つけた技術的欠陥（教科横断比較でのバイアス）の詳細は上記docsファイル参照。commit `b3cf578`。
- 両方ともcommit・push済み、テスト344件・型チェックともにパス、Playwright実機確認済み。
- 未確認事項：`src/components/`配下に未追跡の「〜コピー.tsx」ファイルが6件ある（ChapterCurriculumSuggest/CurriculumSubtopicPicker/CurriculumSuggestの本体＋テスト）。今回の作業とは無関係で、いつからあるか・意図的かは未確認のまま。次回、ユーザーに要不要を確認すること。
- 残作業（変更なし、そのまま）：エクスポート/インポート機能（複数端末同期の代替、まだ未実装）、数値inputの`Math.max`即時強制パターンの横展開チェック（上記「実装上の既知の注意点」参照、未実施）。

**その他の見送り中バックログ（低優先）：**
- 国語・社会のさらなる暗記展開：構造上は「番号で管理する暗記範囲（VocabRange、labelは自由テキスト）」を複数登録すれば文法・漢文句法等も既に載る。唯一の引っかかりは表示名が教科固定（`vocabLabels.ts` の「国語＝今日の漢字・古文単語」）で範囲ごとに出し分けられない点。ユーザーは「実装しないでいい」と保留。
- 複数テスト日はスコープ外のまま（Subject.testDate 単数）。将来やるならデータモデルは案1（Chapterごとに`testDate?`、Subject.testDateはフォールバック存続）＝cto検証済み。設計相談の継続用agentId（ceo/cto/ux）は `docs/feature-onboarding-wizard.md` 末尾に記載。
