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
- `Chapter` — the unit of understanding tracking. Holds `understanding` (0.0–1.0), `targetUnderstanding` (default 0.8), `pointWeight` (exam point weight, used in priority scoring), `lastStudiedDate`, optional `metadata` (exercise count, learning scope, difficulty — informational, not used in scoring), and optional `subtopics` (see below).
- `ChapterSubtopic` — a chapter can optionally be broken into subtopics, each independently tracking `understanding`, `basicProblems`/`advancedProblems` (target problem counts), `teacherHinted` (priority boost), etc. Chapters without subtopics keep working exactly as they did in Phase 0 (dual-path design throughout `logic.ts`) — see `docs/feature-mitoshi.md` for the full design.
- `StudySession` — a logged study session (chapter or subtopic, minutes, correctRate, selfReport, problem counts) that drives understanding updates.
- `AvailabilitySettings` — weekly recurring time slots (`weeklySchedule`, keyed by day-of-week 0–6) plus `dateOverrides` for one-off days (e.g. travel). This indirection is deliberate: a future calendar integration would only need to replace the input source, since plan generation always asks "how many minutes available on date X" via `availableMinutesForDate`.

**Core algorithms** (`src/logic.ts`):
- Understanding update (§6.1): `observed = 0.7×correctRate + 0.3×(selfReport/5)`, then exponentially smoothed: `understanding_new = 0.5×observed + 0.5×understanding_old`. Constants: `OBSERVED_CORRECT_WEIGHT`, `OBSERVED_SELF_WEIGHT`, `SMOOTHING_ALPHA`.
- Initial understanding (no sessions yet): self-report alone, or blended with a known recent correct-rate via `computeInitialUnderstanding`. If a chapter was broken into 2–4 sub-topics during onboarding, `averageInitialUnderstanding` averages their self-reports instead.
- Forgetting decay: `decayedUnderstanding(chapter, today)` exponentially decays `chapter.understanding` based on days since `lastStudiedDate`, half-life `FORGETTING_HALF_LIFE_DAYS = 21`. This is a **read-time-only** calculation — the stored `understanding` value itself is never mutated by decay. All scoring (`priority`) uses the decayed value, not the raw stored one. `decayedSubtopicUnderstanding` is the subtopic-level equivalent.
- Priority score (§6.2): `priority = pointWeight × max(target − decayedUnderstanding, 0) × proximity`, where `proximity = 1 / daysLeft(testDate)`. `subtopicPriority` is the subtopic-level equivalent (shares the chapter's `pointWeight` evenly across subtopics, applies a `teacherHinted` boost). `scoreChapterOrSubtopics` dual-paths between the two.
- Plan generation (§6.3, `generateTodayPlan`): greedy allocation — sort chapters/subtopics by priority descending (via `scoreChapterOrSubtopics`), filter out items already at/above target (score ≤ 0), then consume `dailyMinutes` one item at a time. Chapters without subtopics get a fixed `SESSION_MINUTES` (45 min) allocation, one per day (unchanged from Phase 0). Chapters with subtopics can contribute multiple items per day, each clamped between `MIN_SUBTOPIC_SESSION_MINUTES` (10 min) and `SESSION_MINUTES`, sized from `estimateSubtopicRemainingMinutes`'s time estimate. `buildReasons`/`buildSubtopicReasons` attach human-readable justification labels (配点が高め / 理解度が低め / テストが近い / 先生のヒントあり) for display.
- Time estimation (`estimateSubtopicRemainingMinutes`): per-subtopic remaining study time from basic/advanced problem counts and current understanding gap, using either default per-problem-minute constants or a per-subject *learned* rate (`learnedProblemRates`) once enough real session data exists.
- Pace judgment (`subtopicUnderstandingTier`/`subtopicProblemTier`): achievement-based (not time-invested-based) "on_track / slightly_behind / at_risk" classification per subtopic, shown on the Dashboard.

**Screens** (`src/App.tsx` tab router, gated by `data.onboarded`): Onboarding → Home (today's plan) → SessionRecord → Dashboard (understanding vs. target, days left, pace badges) → Settings (edit/reset). `Onboarding.tsx` is also where subjects, chapters, point weights, initial self-reports, sub-topics, and optional metadata are entered; it's the most complex form in the app.

**Today's plan snapshot / freeze (added 2026-07-05):** `Home.tsx` no longer shows whatever `generateTodayPlan` returns live on every render. `AppData.todayPlan` (`{ date, itemKeys: {chapterId, subtopicId}[] } | null`) freezes *which* chapters/subtopics are today's target set the first time Home is opened that day (`store.tsx`'s `ensureTodayPlan`, called from a `Home.tsx` `useEffect`, is a no-op if a same-date snapshot already exists). `logic.ts`'s `buildPlanFromItemKeys(chapters, subjects, itemKeys, today, sessions)` re-derives display data (`allocatedMinutes`/`reasons`/`priority`) fresh from current chapter data every render — only the *set* of items is frozen, not their displayed numbers, so editing a chapter in Settings still updates its reason chips same-day. This exists because completing an item used to free up its time budget and immediately pull in the next-best chapter, so the list never visibly finished ("無限に出てくる" — user-reported). Completion is derived, not stored: an item counts as done if `data.sessions` has a same-day session for its chapterId(+subtopicId); no `completed` flag anywhere. Vocab/memorization cards are NOT part of this freeze — they stay live every render (deliberate: an intentional "escape valve" for students who finish early, per ux-reviewer).

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

**ワークフロー：** ユーザーから実装タスクを受けたら、engineer エージェントに詳細仕様を渡して委譲する。実装が終わったら ux-reviewer エージェントを呼んで品質確認する。CEO/CTO は夜間会議および製品方向性の判断に使う。実装後は実際に `npm run dev` で動かして（可能なら Playwright で）目視確認する — 型チェック・テスト・コードレビューだけでは見えないUI不具合が繰り返し見つかっているため（詳細は `docs/feature-mitoshi.md` の "Takeaway for future phases" 等を参照）。

**計画立案時の相談方針：** 実装計画を立てる段階で、UI設計の選択肢（例：カレンダーUI vs. シンプルな日付入力）や優先順位判断など、答えが自明でない論点が出たら、コードを書き始める前に該当する専門サブエージェント（ux-reviewer / ceo / cto）に具体的な質問を投げて意見を仰ぐ。ユーザーに都度判断を仰ぐ前に、まずサブエージェントの見解を集めてから選択肢を絞り込む。

**セッション引き継ぎ時のcommit/push方針（ユーザー指定、2026-07-02）：** ユーザーから「引き継ぎをして」「新しいチャットに行く」など、セッションの区切り・引き継ぎを依頼された場合、CLAUDE.md等への引き継ぎ内容の記録に加えて、その時点までの変更を **commitし、さらに`git push`まで行う**（毎回都度確認を取らなくてよい — この一文自体がユーザーによる恒久的な事前承認）。対象ブランチは作業中のブランチ（現状 `claude/app-dev-per-plan-qur753`）。このブランチへのpushは `.github/workflows/deploy-pages.yml` によりGitHub Pagesへの自動デプロイも伴うことを踏まえておく。ただし、コミット内容に機密情報や意図しない変更が混ざっていないかは通常通り確認すること。

**Nightly meeting (local)**: `scripts/nightly-meeting.bat` runs via Windows Task Scheduler. It calls `claude --dangerously-skip-permissions -p "..."` to start a local Claude Code session, which invokes the ceo/cto subagents for ~8 rounds of debate, then saves the result as a Gmail draft to ssei59386@gmail.com. Check Gmail drafts folder each morning for results. Execution log is appended to `scripts/nightly-meeting.log`. Everything runs locally — no cloud triggers, no remote sessions.

## Current status (2026-07-03)

**Phase 0: functionally complete.** All 5 screens exist and work; all originally-known gaps are resolved. Full history (input validation, onboarding escape hatch, save-error banner, subtopic editing, test coverage buildout — 89 tests reached at the end of that work) is in **`docs/phase0-history.md`**.

Still-open backlog items from that history (not yet scoped/resolved, low priority):
- Onboarding's chapter-registration card is dense (up to 9 fields per chapter); moving the purely-informational `metadata-block` (exercise count/learning scope/difficulty) to Settings-only has been suggested twice by ux-reviewer but deliberately deferred both times. Revisit next time Onboarding's form load is reconsidered.
- Product idea (not scoped): AI-generated comprehension tests calibrated to the school's exam level. Copyright risk flagged for anything beyond the student's own handwritten notes — needs real legal review before scoping. Phase 1+ only, do not build UI for this in Phase 0.

**"見通し" (pace/progress forecast) feature: Phase 1〜5 COMPLETE — functionally complete.** This is the current major feature — subtopic-level understanding/pace tracking, curriculum-data-backed suggestions, subtopic-level daily plan generation (Phase 4.5), and (as of Phase 5) day-by-day forward simulation + knapsack triage of cut-candidates on the Dashboard. Full design history, confirmed decisions (do not re-ask), and phase-by-phase implementation logs are in **`docs/feature-mitoshi.md`** — **read this file before resuming work on this feature**, it contains decisions that should not be re-litigated (e.g. the user's explicit override of a CEO/CTO recommendation to build a minimal version instead). Test suite: **241 tests** as of the end of the 2026-07-03 Phase 5 session — run `npm test` to confirm nothing regressed before continuing. **Only remaining Phase 5 follow-up:** on-device visual QA in a real mobile browser was not done (no browser-automation tool in that session); dev server starts clean and jsdom tests render the section, but color/layout/tap-feel on a phone should be eyeballed on a subtopic-heavy dataset that trips the 45-min threshold. The write-back "今回は捨てる/exclude-from-plan" toggle was deliberately deferred (triage is informational only).

**Curriculum reference data (math + science): RESOLVED, both fully built and integrated** into the "見通し" feature's suggestion layer (`src/data/curriculumSearch.ts`). Full research-task history is in **`docs/curriculum-data.md`**.

## セッション引き継ぎメモ（2026-07-04、社会・国語暗記対応セッション終了時点）

**暗記科目対応：英語・社会・国語がすべて実装完了・commit・push済み**（commit `5002627`、ブランチ`claude/app-dev-per-plan-qur753`）。GitHub Pagesへの自動デプロイも走っている。テストスイートは**306件**全通過、`npx tsc --noEmit`・`npm run build`ともパス。詳細な設計経緯（v1〜v4）は**`docs/feature-memorization.md`**参照——特に末尾の「確定設計 v4」節。

- 英語＝単語、社会＝重要語、国語＝漢字・古文単語として、共通の「番号で管理・紙に印・20語ずつの枠単位Leitner」方式（`VocabRange`/`VocabChunk`）で動く。ロジック層（`src/logic.ts`）・データ型は教科非依存で無変更のまま。
- **社会・国語は「暗記のみ」の教科で、章（理解度モデル）を持たない**——現代文読解などはスコープ外（ceoの「1教科に2モデル混在は複雑」という懸念を踏まえた意図的な設計）。Onboarding/Settingsとも、章を持てるのは数学・理科・英語のみという前提でUIが分岐している。
- Home画面の暗記カードは教科ごとに分割済み、クイズも押した教科の暗記範囲だけに絞り込まれる（`src/components/vocabLabels.ts`に表示名マップを集約）。ux-reviewer指摘（重大5件・中程度4件・軽微1件）はすべて反映・実機確認済み（Playwrightで英語＋社会の2教科同時登録→教科別クイズ絞り込みまで目視確認）。

**まだ手を付けていない・次回相談すべき論点：**
- **オンボーディングのテスト日入力欄が数学・理科・英語・社会・国語の5教科分ずらっと並び、画面が長い**（ux-reviewer指摘、ユーザーも実機で確認済み）。今回は意図的に見送り。次にオンボーディングを触る際、構造の見直し（例：使う教科を先に選ばせてから該当欄だけ出す等）をceo/ux-reviewerに相談してから着手すること。
- 国語・社会をさらに展開する場合（漢字ドリル以外の分野、他の暗記科目パターンなど）は、まず英語・社会・国語の実運用結果を見てから判断する方針（ceo推奨、英語のときと同じ考え方）。

**このセッションでの副産物：**
- `.claude/agents/engineer.md`に事故防止ルールを追加済み（既存ファイルへのWrite禁止、編集後の`git diff`自己確認）。前回セッションでengineerが既存ファイルを誤って全体上書きする事故があったための対策——次のセッションでも有効。
- 利用上限の確認方法：`/status`コマンドの「Usage」タブで5時間・7日間のレート制限使用率が見られる（コンテキストウィンドウ使用率とは別物）。
- 2026-07-04 01:00 JSTに一度きりのクラウドルーティン（trig_011MmY4djWr8cEgicccdJJua）を予約実行していたが、pushしない設定で走らせたためこのローカルセッションの成果とは無関係・重複作業。結果を見たい場合は https://claude.ai/code/routines 参照。
- dev serverをバックグラウンドで起動済みの場合がある（`npm run dev`、http://localhost:5173/）。次のセッションでは新たに起動し直して問題ない。

## セッション引き継ぎメモ（2026-07-05、今日の計画スナップショット実装＋Phase 6設計セッション終了時点）

**今回commit・push済みの完了作業：「今日の計画スナップショット」機能。** 詳細はCLAUDE.md「Architecture」節の "Today's plan snapshot / freeze" を参照（そちらに実装内容を統合済み）。要点だけ言うと：1件記録するたびに次の項目が滑り込んで終わらない、というユーザー報告バグを、今日開いた瞬間の対象集合を日付が変わるまで固定する方式で解消した。ux-reviewerの実装後レビュー（重大2件含む）もすべて反映済み。型チェック・テスト**312件**全通過、Playwrightで実機動作も確認済み（章完了→✓バッジ、全件完了→専用メッセージ、暗記カード残存時も文言が矛盾しないことまで確認）。

**次回最優先：Phase 6（設計済み・未実装）。** 同じセッションでユーザーから「今の計画の立て方は、限られた時間で最高点を狙うという目的にちゃんと沿っていない」という核心的な指摘が入り、ceo→cto→cto追加相談まで済ませて方向性が確定した。ユーザー本人が「ここがうまくできれば完成と言っていい」と位置づけている最重要タスク。**フルの設計は `docs/feature-mitoshi.md` の "Phase 6: plan-quality under real time constraints (designed, not yet implemented)" 節に全部書いてある——次のセッションはここを読んでから着手すること。** 要点だけ言うと：
1. 「見通し」シミュレーション（Phase 5、間に合うか判定）を小項目の無い普通の章にも拡張する。
2. 判定結果を`generateTodayPlan`自体に反映し、間に合わない章を今日の計画から除外して浮いた時間を間に合う章に回す（優先度の計算式自体は変えない）。
3. 科目ごとに「実際の理解度の伸びペース」をセッション履歴から学習し、残り所要時間の見積もりに反映する（`learnedProblemRates`と同じ、サンプル不足時はフォールバック＋倍率クランプのパターン）。
4. 文言は常に前向き（「間に合わない」「諦める」は言わない）。手動の「捨てる」ボタンは作らない。全滅防止の安全策も要る。

**この方向性はまだユーザーの実装ゴーサインを得る直前で引き継ぎになった** — 次のセッション開始時、ユーザーに「このまま進めていいか」を一度確認してから着手するのが安全（会話の流れ上ほぼ合意済みだが、明示的なgoは無い）。
