# Curriculum reference data — research task history

Both the science and math curriculum reference datasets are **RESOLVED / done**. This file holds the full task history and design notes. It was split out of `CLAUDE.md` on 2026-07-03 to keep that file's auto-loaded context small — see `CLAUDE.md`'s "Current status" section for the short pointer back here. Neither dataset is wired into any UI directly by name yet — they're consumed through `src/data/curriculumSearch.ts`'s fuzzy-match layer, built as part of the "見通し" feature (see `docs/feature-mitoshi.md`).

## Science curriculum reference data — RESOLVED (2026-07-02)

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

## Math curriculum reference data — RESOLVED (2026-07-02)

**Status: done.** 9 parallel research agents (one per 中1/中2/中3/数I/数A/数II/数B/数III/数C) cross-referenced 学習指導要領 and major textbook publishers (東京書籍/啓林館/数研出版/実教出版), then results were compiled into `src/data/mathCurriculumReference.ts` — an array of `CurriculumBlockData` (block/subject/chapters), each chapter holding `CurriculumSubtopic[]` (name + 1–5 `difficultyLevel`). `npx tsc --noEmit` passes. This data is not wired into any UI directly by name — see "How the app would eventually consume this" below, which was later implemented as `src/data/curriculumSearch.ts` (see `docs/feature-mitoshi.md`'s Phase 1).

**Open reconciliation question, still unresolved**: this dataset uses a 5-level difficulty scale, while `ChapterMetadata.difficultyLevel` in `src/types.ts` uses 3 levels — deliberately left as a mismatch (the two scales are kept separate rather than reconciled; see `docs/feature-mitoshi.md`'s Phase 3 ux-reviewer pass item 2 for how the UI disambiguates them: "章の難易度（3段階）" vs "難易度（カリキュラム参考・5段階）").

**Difficulty-label audit (2026-07-02) — accepted as-is, no fixes applied.** A read-only review agent audited all 9 blocks' `difficultyLevel` values for internal consistency. Findings: no out-of-range values, no within-chapter reversals (e.g. rote memorization rated harder than a genuinely hard calculation). It did flag cross-block scale drift — 中3 has three "5"-rated subtopics (二次方程式の利用／円の性質の証明・作図／三平方の空間利用) while 数I〜数B barely use "5" at all (数I has exactly one, 数A/数II/数B have zero), and 数III has zero "1"-rated subtopics. **User's call: leave this as-is.** Rationale (user's own words): this app is primarily for 定期テスト (regular in-school exam) prep, where a student is only ever comparing chapters within their *current* grade/subject — not 中3 against 数III in the same priority queue — so cross-grade scale drift doesn't actually distort any real prioritization decision. More importantly, `difficultyLevel` in this reference dataset is only ever meant to seed an *initial* estimate; actual prioritization in the shipped app already runs on live `understanding` data from `updateUnderstanding`/session records, not this static reference. Do not re-raise the cross-block drift finding as a blocking issue in future sessions unless the consumption design changes to compare across grade levels.

The original brief below is preserved for context on how the data was produced.

**(Historical) Original brief**: This was a separate, mostly-independent research/content-authoring task that came out of the forecast-feature design (the `MINUTES_PER_PROBLEM`/difficulty guesses would be better-seeded with real curriculum data instead of pure guesses). It did **not** need forecast-feature design nuance to execute, and was large enough (user-approved estimate: "several hours" for the properly cross-referenced version, vs. 30–60 min for an unverified quick draft — user chose the thorough version) that it deserved a fresh context budget rather than growing an already-long session.

**Important framing, to avoid confusion with Phase 0's "no AI features" rule**: this is a **dev-time content-authoring task** — an LLM (Claude, in a dedicated session) producing a static reference data file that ships bundled with the app, with **zero runtime AI calls** in the shipped product. That's categorically different from the Phase 1+ "AI features" that `CLAUDE.md`'s Product direction section says to keep out of Phase 0 (e.g., AI-generated tests at runtime). Building this reference file is no different in kind from the rest of this app being built with Claude Code's help — it does not violate the Phase 0 AI boundary.

**Scope (confirmed)**: Japanese 中学1〜3年 + 高校数学 **including 数III・数C** (full scope is 中1・中2・中3・数I・数A・数II・数B・数III・数C, 9 blocks).

**Subtopic granularity (confirmed, refined)**: don't force maximum granularity — where a chapter's sub-areas are naturally similar in difficulty/scope (e.g., within 「ベクトル」), it's fine to merge them into fewer, broader subtopics. The bar is **"necessary and sufficient to meaningfully distinguish difficulty levels"** — enough subtopics that difficulty differences within a chapter are actually captured, not so many that adjacent subtopics would get the same difficulty label anyway (in which case they should just be merged). Use judgment per chapter rather than a fixed subtopic count.

**Difficulty scale (confirmed): 5 levels, not the app's 3-level `ChapterMetadata.difficultyLevel`.** This was a deliberate mismatch, later resolved by keeping both scales separate (not reconciled) — see the "Open reconciliation question" note above.

**Output format (confirmed): prioritize ease of later implementation.** Structured as typed data (TypeScript with exported interfaces, consistent with how `src/types.ts` models the rest of this app's data) rather than loose prose or an unstructured table, so it can be imported and consumed programmatically without a reformatting pass.

**Time budget (confirmed): generous — thoroughness over speed was explicitly fine here**, per the user's own words ("時間を多くかけていい").

**Sourcing approach**: cross-referenced against real curriculum structure (学習指導要領, and/or major textbook publishers' tables of contents — 東京書籍/啓林館/数研出版 etc.) via the `WebSearch`/`WebFetch` tools, rather than relying purely on training-data recall, since the user explicitly asked for "裏どりしながら" (fact-checked) labeling. Difficulty labels themselves were still ultimately each generating agent's own best-effort judgment — there's no authoritative source for "difficulty," only for the unit/chapter structure itself.

**Execution plan used**: dispatched several parallel research agents, one per grade/subject block — 中1, 中2, 中3, 数I, 数A, 数II, 数B, 数III, 数C (9 blocks) — each cross-checking its chapter → subtopic breakdown via web search against real sources, each producing a structured chunk (chapter name → subtopic names → 5-level difficulty label), then compiled all chunks into `src/data/mathCurriculumReference.ts`.

**How the app consumes this**: implemented as `src/data/curriculumSearch.ts` during the "見通し" feature's Phase 1 (see `docs/feature-mitoshi.md`) — when a student registers a chapter/subtopic name in `Onboarding.tsx`/`Settings.tsx`, fuzzy/substring-match against this reference suggests a default difficulty that the student can accept or override. The app's free-text chapter/subtopic naming remains the primary input method; this reference is only ever an optional suggestion layer, never a forced picklist.
