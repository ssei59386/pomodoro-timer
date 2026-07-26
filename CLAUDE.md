# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**This file is kept intentionally lean** — it's auto-loaded as project instructions for every new session, so it holds only durable architecture/workflow facts plus short pointers to detailed history. Full phase-by-phase implementation logs, ux-reviewer findings, and design-debate transcripts live in `docs/` instead (see "Current status" below for which file covers what). When a feature's detailed history grows large, split it into `docs/` the same way rather than letting it accumulate here.

## What this is

定期テスト学習進捗管理アプリ（Phase 0 最小版）— a mobile-first PWA that helps students maximize exam scores by managing per-chapter understanding levels: self-report/measure understanding → allocate study time to chapters that will move the score most → re-measure and re-plan. No backend, no login — all data lives in the browser's `localStorage`.

**教科は5つ実装済み**（数学・理科・英語＝章を持つ理解度追跡型、社会・国語＝暗記専用でLeitner反復管理）。README.md や以前のこのファイルには「Phase 0 は数学・理科のみ」「5教科は対象外」とあったが、それは**古い記述**で、実際は英語・社会・国語まで拡張済み（`docs/feature-memorization.md`、`onboarding/onboardingTypes.ts` の SUBJECT_ORDER 参照）。暗記モードは実装済み。Forgetting-curve decay も実装済み（`decayedUnderstanding`、下記参照）。AI機能は後悔防止トリガー限定で導入済み（下記「AI advice」セクション参照）、それ以外への拡張は引き続きスコープ外。

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
- `ChapterSubtopic` — a chapter can optionally be broken into subtopics, each independently tracking `understanding`, `basicProblems` (target basic-problem count), `teacherHinted` (priority boost), etc. Chapters without subtopics keep working exactly as they did in Phase 0 (dual-path design throughout `logic.ts`) — see `docs/feature-mitoshi.md` for the full design. **発展問題(`advancedProblems`/`advancedProblemsCompleted`)は 2026-07-09 に廃止**（数えにくく達成段階ラダーの段階5「発展問題が解ける」と二重管理のため。ユーザー判断）。型フィールドは後方互換で残置してあるが読み書きしない。時間見積もり・ペース判定は基礎問題数＋理解度の伸びしろのみ。`track?: "grammar"|"reading"`（英語のみ、段階7）で記録画面のラダーが切り替わる。
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

## AI advice — the one exception to "no backend, no login"

後悔防止トリガー（「続ける/覚えるモードにする」の二択）にのみ、AIとの短い壁打ち相談（「🤖 AIに相談する」）を追加している。これはこのアプリで**唯一**、開発者が運用するサーバーを呼び出す箇所であり、意図的に範囲を絞ってある。将来このセクションを一般的なバックエンドへ拡張したり他機能に流用したりする前に、必ず再設計の相談をすること。

- **アーキテクチャ**: `src/aiAdvice.ts`がこの機能唯一のネットワークI/O担当（匿名ID生成/永続化、リクエスト/レスポンス型、エラー分類）。`store.tsx`/`storage.ts`と同じ層に置き、`logic.ts`（純粋関数のみという不変条件、`logic.test.ts`もその前提）には一切置かない。UIは`src/components/ForecastDecisionAiChat.tsx`（`Home.tsx`の`ForecastDecisionCard`から利用）。この機能のために`store.tsx`のメソッドや`AppData`/`types.ts`のフィールドは一切追加していない。
- **サーバー側**: `worker/`配下に独立したCloudflare Workerが1つ（Viteビルドには含まれない — ルートの`tsconfig.json`の`include`が`["src"]`のみなので自動的に対象外）。共有のAnthropic APIキーを`wrangler secret`で保持し、軽量モデル（`claude-haiku-4-5`）＋固定システムプロンプトでトーン（「落ち着いた伴走者」、ストリーク機能と同じ煽らない方針）を制御して中継する。デプロイ手順は`worker/README.md`参照。
- **サーバーに渡る情報の正確な範囲**: 教科名・章/小項目名・テストまでの残り日数、および生徒が入力した相談文のみ。**詳細な学習履歴・理解度の数値そのものは送らない** — 「生徒の学習データは一切経由しない」という言い方は過度に強く不正確なので使わない。
- **永続化しない**: 会話は`ForecastDecisionAiChat`のコンポーネントstate（`useState`）のみで保持し、パネルを閉じる/画面を離れると消える。`AppData`・`localStorage`・Worker側のどこにも書き込まない。Worker自体もリクエスト単位でステートレス（Workers KVのレート制限カウンタ2種のみが例外、匿名IDは端末のlocalStorageに保持される乱数UUIDでアカウントとは無関係）。
- **レート制限は「なりすまし対策」ではなく「最大被害額（コスト）の天井」**: ①グローバル日次上限（本丸、KV）②匿名UUID単位の日次上限（粗い網、消せば回避可能と割り切る、KV）③Cloudflareダッシュボードのみで設定するIPバックストップ（このリポジトリのコードには存在しない）。
- **この機能を安易に拡張しないこと**: 2つ目のAI機能を足したくなったら、それは新しい設計相談であり、この機能の延長として当然に拡張してよいものではない。

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

## セッション引き継ぎメモ（2026-07-26 続き、AI活用機能の方針検討・コード変更なし）

**このセッションはコード変更なし（設計方針の検討のみ、commit対象ファイルなし）。決定事項は自動メモリの `project_ai_usage_direction_2026_07_26.md` に詳細記録済み**、次セッションはそちらを読めば経緯を追える。要点のみここに残す:

- テスト問題作成以外のAI活用アイデアをブレスト。**トラックA（小項目ごとの確認質問＋AI判定で理解度アップの妥当性を判断）は規模が大作業につき後回し、未着手**。**トラックB（既存の後悔防止トリガー「続ける／覚えるモードにする」の二択にAI壁打ち相談を追加）を先行させる方針で確定**。
- AIのキャラクター性は「熱血家庭教師」案が出たが、既存のストリーク機能で確立した「煽らないトーン」方針（[[project_streak_backup_2026_07_26]]）と衝突するため、**「落ち着いた伴走者」トーンに決定**。
- **認証方式：BYOK（生徒が自分のAnthropic APIキーを使う）は不採用と確定**。理由はUXの手間ではなく、Anthropicのconsumer利用規約がアカウント作成に18歳以上を要求しており対象ユーザー（中高生）の多くが年齢・決済要件を満たせないという構造的な問題（ユーザー判断）。**代わりに「アプリ側の共有APIキーを軽量バックエンドプロキシで保持し生徒側は無設定」の方式に確定**。
- cto agentに技術検証を依頼し、**推奨構成が固まった**：Cloudflare Workers（単一エンドポイント）＋ Workers KV（グローバル日次上限＋匿名ID別日次上限）＋ Cloudflare Rate Limiting Rules（IPバックストップ）。CORSはGitHub PagesオリジンをExact指定。CLAUDE.mdの「バックエンドなし」原則は書き換えではなく**明示的な例外セクションを1つ追加**する形にすること（生徒の学習データ自体はWorkerを一切経由しないため製品原則は無傷、という位置づけを明記しないと将来セッションが誤読してスコープクリープする、とcto指摘）。fetch呼び出しは`logic.ts`（純粋関数のみという不変条件）に置かず新規モジュールに隔離。実装規模は最低2セッション（①インフラ構築 ②フロント統合＋UI＋ux-reviewer確認）。
- **cto指摘の未解決論点（着手判断はまだしていない）**：新規インフラを一つ持つ運用コストに対し、後悔防止トリガー自体が低頻度（生徒一人あたり週数回程度）でこの機能はそのさらにオプション扱いという「費用対効果の低さ」が明確に指摘された。**次にやるべきは、この費用対効果を踏まえて本当に着手するか（あるいはceo agentにも相談するか）をユーザーと詰めること**。トラックBの実コーディングはまだ一切着手していない。
- 上記とは別に、雑談の中で「セッション数は少ないのにコンテキストが急増した」という質問があり、原因は`claude-api`スキル呼び出し1回（関連ドキュメント一式を丸ごと読み込む仕様）が突出して大きかったため、と説明済み（次回同種の技術質問をする際は踏まえておくとよい）。
- **市場競争力・アプリストア配信についての雑談も発生（着手は保留、構想のみ）**。見通し機能（理解度不足×テスト近さで自動計画組み替え）は他の学習管理アプリに無い核の差別化と評価しつつ、機能を足すだけでは配信力・信頼構築（Studyplus等の実績あるSNS型競合との差）が主な壁になるという整理をした。アプリストア配信の技術的現実性も確認：**Android(Google Play)はTWAで比較的容易**（既存PWAをほぼそのまま包める、開発者登録$25一回払い、工数1〜2セッション程度）、**iOS(App Store)はCapacitorで可能だが負担が重い**（Apple開発者登録$99/年の継続課金、Mac/クラウドビルド環境が必要、審査で「Webの皮かぶせ」と判断され却下されるリスクあり）。**いずれも未着手・構想段階のまま保留**。着手する場合は事前にcto agentへCapacitor導入の実装コスト・既存コードへの影響範囲を検証させること。詳細はメモリ [[project_appstore_distribution_2026_07_26]] 参照。

## セッション引き継ぎメモ（2026-07-26、バックアップ機能＋ストリーク＋トリガー1日化＋完了目安表示 完了・commit/push済み）

**このセッションで入れた4件はすべて commit + push 済み（本番反映）**。最新commitは `e8c22e4`。テスト417件全通過・tscクリーン・build成功。engineer 委譲＋自分で差分/ビルド確認する運用で進めた。要点:

- **① データのバックアップ機能（エクスポート/インポート）**＝2026-07-09 の最優先バックログを消化。`storage.ts` に `exportDataToJson`/`parseImportedData`（＋`loadData` と共通の `normalizeAppData` を切り出し）、`store.tsx` に `replaceAllData`、`Settings.tsx` に「データのバックアップ」カード（書き出し／二段階確認付き復元／件数プレビュー）。**トップレベル `ErrorBoundary`（`src/components/ErrorBoundary.tsx`、main.tsx で全体を包む）も追加**＝壊れたデータ復元で白画面になっても「リセットして最初からやり直す」導線が出る安全網。commit `4f94184`。
- **② 連続記録ストリーク**＝「続けたくなる仕掛け」。`logic.ts` の `computeStreak`（今日未記録でも昨日まで続けば生存扱い、途切れれば黙って0）。Home に3日以上で「◯日連続で記録中」チップ、記録保存後に「◯日連続で記録できています」1行。**CEO判断で新規アニメ/効果音/教科別ストリーク/途切れ罪悪感メッセージは入れない**（アプリの煽らないトーン厳守）。commit `a1f37f2`。
- **③ 後悔防止トリガーの発動を3日連続→1日に変更**（**ユーザー判断**）。`SHORTFALL_STREAK_THRESHOLD_DAYS` 3→1。スヌーズ（`FORECAST_DECISION_SNOOZE_DAYS`）は3日据え置き。関連UI文言・docs・当メモも更新済み。詳細/経緯は `docs/feature-study-policy.md` と メモリ [[project_forecast_trigger_1day_2026_07_26]]。commit `154a866`。
- **④ 完了までの目安表示**＝「あとどれくらいで終わるか」をユーザー要望で数値化。`simulateForward` が既に持つ `totalMinutesNeeded`/`projectedCompletionDate` を Dashboard の各章・小項目に「残り約◯分・M月D日ごろ終わる見込み」として表示（`ForecastRemainingNote`）。**順調な項目だけ**表示（達成済み・間に合わない見込みには出さない＝二重にネガティブ情報を出さない）。新規計算ロジックは無し。commit `e8c22e4`。

**セッション中に浮上した未着手のプロダクト論点（次に有力）：**
- ユーザーの生の課題感＝**「このアプリで一番強く惹かれる部分（＝見通し／このペースで間に合うかの先読み計算）が、使う人の目の前に十分出てきていない」**。①見通しはダッシュボードの奥＋「間に合わない時だけ」しか声をかけず、順調な時に"計算してくれている実感"を日常的に感じる場面が無い。②Home 説明文が「仕組みの説明」止まりで「だから点が伸びる／間に合う」の**効能の言葉**になっていない。→ **提案済みの方向：Home に見通し結果を1行、順調な時にもさりげなく出す（既存の固定説明文と置き換える形で画面を増やさない）。着手前に ux-reviewer と文言トーンを詰める**。④の完了目安表示はこの流れの一部として着手したもの。次セッションはここを深めるのが有力。
- 「機能の利点を使う人に伝える」は**新画面/ツアーは作らず、各機能が使われるその場に効能の一言を添える**方針でユーザーと合意ずみ（生徒はツアーを読み飛ばす／既存の設計思想＝その場完結の説明文と一貫）。

**引き続き未着手の低優先バックログ：**
- 続けたくなる仕掛けの残り：**記録時の達成感演出**（ストリークは入れたが演出自体はまだ最小のまま）。
- `src/components/` 配下の未追跡「〜コピー.tsx」6件は**今回も未確認のまま**（毎回 git status に出続ける）。次に一度ユーザーへ要不要を確認して消すとよい。
- 数値inputの `Math.max` 即時強制パターンの横展開チェック（未実施）、教科CRUD全体の実機QA（未消化）。
- リマインド通知（iOS制約重く見送り）、AI機能（著作権整理先）、複数テスト日（1教科1testDate維持）は今も入れない方針。

---

## セッション引き継ぎメモ（2026-07-09、教科テンプレート化＋達成段階エンジン 段階1〜7＋発展問題廃止 完了・commit/push済み）

**進行中だった大型機能は一区切り。詳細は `docs/feature-subject-templates.md` を必ず読むこと**（決定事項・段階別実装ログ・残作業が全部そこにある）。承認済みプラン全文は（リポジトリ外）`~/.claude/plans/soft-swinging-hippo.md`。最新commitは `7b27755`「段階6-7完了＋発展問題を廃止」。要点のみここに残す:

- ユーザー要望「教科を複数登録できるように」＋「理解度の入れ方の言葉の食い違いをなくす」から着手。**両方まとめて一度に**、要件2は「記録の仕組みごと作り替え（＝下記 Phase 3 相当）」をユーザーが明示選択。
- **段階1〜7 完了**（テスト398件全通過・build成功・tscクリーン・段階6/7とも実機QA済み）。教科を**テンプレから自由に複数追加/削除**（数学I・数学A、保健体育等）でき、記録画面が**達成段階(1〜5)選択**に統一、`SubjectKey` 固定を撤廃し `src/data/subjectTemplates.ts` の `resolveTemplate` に一本化、`vocabLabels.ts` は削除。段階6で**社会を `chapterCapable:true` に章化**（vocab併存＝D1、英語と同じchapter+vocab両対応）、`SelfReportPicker.tsx`＋付随CSSを削除。段階7で**英語の文法/読解トラック分割**（`studyPolicy.ts` に `ENGLISH_GRAMMAR_LEVELS`/`ENGLISH_READING_LEVELS`＋`studyLevelsForTrack`、テンプレに `trackCapable`、小項目 `track` で記録画面のラダー切替、オンボ/設定にトラック選択UI）。
- その後 **発展問題(`advancedProblems`)を全面廃止**（ユーザー判断。数えにくく達成段階ラダー段階5と二重管理のため）。登録/記録/ダッシュボードの発展UIを全撤去、logic.ts の見積もり・ペース判定を基礎のみに簡素化。型フィールドは後方互換で残置。詳細は `docs/feature-subject-templates.md`「発展問題(advancedProblems)廃止メモ」＋メモリ [[project_advanced_problems_removal_2026_07_09]]。
- **決定事項** D1（社会vocabは消さず併存）/ D2（テンプレは追加時固定）/ D3（既存understanding値は移行せず次回記録でスナップ）は `docs/feature-subject-templates.md` 参照。覆すなら要相談。

**次にやるとよいこと（2026-07-09 にユーザーへ提案・優先度順）：**
1. **【最優先・推奨】データのバックアップ機能（エクスポート/インポート）＝未実装**。全データが localStorage のみのため、ブラウザのデータ消去・機種変で全消失するリスクがある。「固まってきた＝本気で使う」段階なので守りを固めるのが先。設定画面にJSON書き出し/読み込みボタンを足すだけの軽い規模。`storage.ts` の `study-planner-data-v1` を丸ごとダンプ/復元。1セッションで入る想定。**ユーザーはこの提案に前向き**（着手時はまず声かけ）。
2. 続けたくなる仕掛け（連続記録ストリーク・記録時の達成感演出）。
3. リマインド通知はiOS制約が重く費用対効果微妙、急がない。
- **今は入れない方針で合意**：AI機能（著作権整理が先）、複数テスト日（1教科1testDate維持）。

**未消化の実機QA観点（低優先）**：教科CRUD全体（保健体育追加・数学I/数学A複製・削除カスケード）。詳細 `docs/feature-subject-templates.md`。

## セッション引き継ぎメモ（2026-07-08、勉強方針・後悔防止トリガー機能 Phase 1+2 完了時点）

**オンボーディングの本格ウィザード化は完了済み**（`docs/feature-onboarding-wizard.md` 参照）。

**このセッションでやったこと・詳細は `docs/feature-study-policy.md` を読むこと**（決定事項・フェーズ計画・見送り事項が全部そこにある）。要点のみここに残す:

- **「勉強方針・後悔防止トリガー」機能の Phase 1+2 を実装**。目的は「テスト後に『この単元に時間をかけすぎた、別科目に回せば良かった』という後悔をその場で防ぐ」こと。既存「見通し」機能を、黙って表示するだけ→能動的に問いかける形へ格上げ。
  - **Phase 1（勉強方針画面）**: `src/data/studyPolicy.ts`（教科ごとの理解度1〜5ラダー＝各段階の「達成したこと／次にやること」の単一の情報源）＋ `src/components/StudyPolicy.tsx`（理解度タブ上部の「勉強方針を見る」から開くサブ画面、登録教科のみ表示）。
  - **Phase 2（後悔防止トリガー）**: ある章/小項目が `simulateForward` の「間に合わない候補（shortfall>0）」に入ったら Home で「このまま続ける／覚えるモードにする」を問いかける。実装当初は3日連続で発動する設計だったが、**2026-07-25にユーザー判断で1日発動（`SHORTFALL_STREAK_THRESHOLD_DAYS = 1`）に変更済み**（`FORECAST_DECISION_SNOOZE_DAYS`＝続けるを選んだ後の再確認抑制日数は3日のまま変更なし）。`Chapter`/`ChapterSubtopic` に `studyMode?: 'understand'|'memorize'` を追加、`AppData.forecastDecisions` に連続日数・スヌーズを persist。memorize 化した項目は `generateTodayPlan`/`simulateForward` から除外。関連純粋関数は `logic.ts` の「後悔防止トリガー」節（`updateForecastDecisions`/`shouldPromptForecastDecision`/`switchToMemorizeMode`/`restoreUnderstandMode`/`collectMemorizeModeItems` 等）。取り消し導線あり（切替直後のインライン「元に戻す」＋設定画面の一覧）。
  - テスト375件・型チェックともにパス、Playwright実機確認済み（ux-reviewer指摘の重大3件＋中程度も対応済み）。
- **Phase 3（未着手・要再設計、着手前に必ずユーザーと相談）**: 理解度の**更新エンジン自体**を達成段階ベースへ作り替え／社会を「暗記専用」から「章＋周回カウント」へ移行／英語の文法・読解トラック分割／暗記モードの Leitner フル合流。ux-reviewer指摘の「勉強方針が教える段階モデルと、実際の記録入力（SelfReportPicker の全然〜完璧）の言葉の食い違い」もこの Phase 3 で解消する既知ギャップ。
- 未確認事項（変更なし）：`src/components/`配下の未追跡「〜コピー.tsx」6件。今回も未着手・未確認。次回ユーザーに要不要を確認すること。
- 残作業（変更なし）：エクスポート/インポート機能（未実装）、数値inputの`Math.max`即時強制パターンの横展開チェック（未実施）。

**その他の見送り中バックログ（低優先）：**
- 国語・社会のさらなる暗記展開：構造上は「番号で管理する暗記範囲（VocabRange、labelは自由テキスト）」を複数登録すれば文法・漢文句法等も既に載る。唯一の引っかかりは表示名が教科固定（`vocabLabels.ts` の「国語＝今日の漢字・古文単語」）で範囲ごとに出し分けられない点。ユーザーは「実装しないでいい」と保留。
- 複数テスト日はスコープ外のまま（Subject.testDate 単数）。将来やるならデータモデルは案1（Chapterごとに`testDate?`、Subject.testDateはフォールバック存続）＝cto検証済み。設計相談の継続用agentId（ceo/cto/ux）は `docs/feature-onboarding-wizard.md` 末尾に記載。
