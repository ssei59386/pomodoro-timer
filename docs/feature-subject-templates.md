# 教科テンプレート化 ＋ 理解度の達成段階化（設計・実装メモ）

作成: 2026-07-09。ユーザー要望「教科を複数登録できるように」＋「理解度の入れ方の説明との食い違いをなくす」から着手。
承認済みの実装プラン全文は（リポジトリ外）`~/.claude/plans/soft-swinging-hippo.md` にある。本ファイルはリポジトリ内の引き継ぎ用要約。

## 何を作っているか（2つの要件を同時に）

1. **教科を自由に複数登録**：同じ教科の分割（数学I/数学A、物理/化学）も、5教科以外の追加（保健体育など）も両方。従来は固定5教科（`SubjectKey`）から選ぶだけで後から追加不可だった。
2. **理解度の言葉を「達成段階」に統一（記録の仕組みごと作り替え）**：記録画面の「全然〜完璧」という曖昧な手応え＋正答率スライダーを撤去し、勉強方針画面と同じ「達成段階（1〜5）」を選ぶ形へ。`docs/feature-study-policy.md` の Phase 3 相当。

**ユーザー確定事項**：両方まとめて一度に。要件2は「言葉だけ揃える」ではなく「記録の仕組みごと作り替え」を明示選択。

## 中核設計

- **教科テンプレート**（`src/data/subjectTemplates.ts`、新規）：`SubjectTemplateKey`（"math"|"science"|"english"|"social"|"japanese"）と `SUBJECT_TEMPLATES` レジストリ。各テンプレは `{defaultName, chapterCapable, vocabCapable, curriculumSubject, studyPolicy, vocabHeading, vocabItemWord}` を持つ。`resolveTemplate(subject)`（`subject.templateKey ?? 名前逆引き ?? "social"`）が単一の解決口。`levelToUnderstanding(level)=level/5`（4→0.8=既存DEFAULT_TARGET）。
- **`Subject.templateKey?`** を optional 追加（`name` は自由文字列化）。数学I/数学A は両方 `templateKey:"math"` で name/testDate 違いの別Subject。保健体育は `templateKey:"social"`＋自由名。→ **新しい振る舞いモードを足さず任意教科を表現でき、`logic.ts` は無改修**。
- **達成段階エンジン**：`StudySession.achievedLevel?:1|2|3|4|5` を追加。`applySessionToChapter`/`applySessionToSubtopic` は achievedLevel があれば `understanding=level/5` を**直接セット（平滑化しない）**、無ければ旧 `computeObserved`＋`updateUnderstanding` にフォールバック。`sessionObservedUnderstanding` 新規。`subjectPaceMultiplier` も直接セット式へ。`correctRate`/`selfReport` は任意化。

### 決定事項（安全側デフォルト。覆すならユーザーに要相談）
- **D1**: 社会の暗記範囲(vocab)は消さず**併存**（章＋周回 も vocab も両方使える）。既存 vocabRanges/vocabChunks を壊さない。
- **D2**: テンプレートは教科追加時に固定、後から変更不可（capabilityが変わり既存データが宙に浮くため）。
- **D3**: 既存 understanding 値は移行しない。平滑化撤去により切替後の最初の記録で段階値へスナップする（既存データ薄く実害小）。

## 実装進捗（2026-07-09）

**段階1〜7 完了。テスト400件全通過・`npm run build` 成功・`npx tsc --noEmit` クリーン。段階6・7とも実機QA（Playwright）実施済み。**

- **段階1（型＋テンプレ基盤）**：`types.ts`（`Subject.templateKey?`, `StudySession.achievedLevel?`, `correctRate`/`selfReport`任意化, `ChapterSubtopic.track?`）、新規 `subjectTemplates.ts`、`studyPolicy.ts` の `SubjectKey`→`SubjectTemplateKey`、`storage.ts` の loadData で subjects の templateKey 正規化。
- **段階2（logicエンジン）**：上記の達成段階直接セット化＋`sessionObservedUnderstanding`＋`subjectPaceMultiplier` 差し替え。旧エンジンはフォールバックとして残置。
- **段階3（store）**：`addSubject`/`removeSubject`（chapters/sessions/vocabRanges/vocabChunks/forecastDecisions/todayPlan カスケード削除）。ついでに既存 `removeChapter` の forecastDecisions/todayPlan **prune漏れ（実在した）を修正**。共通ヘルパー `pruneForecastDecisions`/`pruneTodayPlan`。
- **段階4（UI capability化）**：新規 `AchievementLevelPicker.tsx`（＋test）。`SessionRecord.tsx` を達成段階選択へ（correctRateスライダー＋SelfReportPicker撤去、初期選択=`round(understanding*5)`）。`Settings.tsx` の日本語名リテラル分岐を全撤去→capability参照＋**教科CRUD UI（追加/改名/削除カスケード確認）**。`Home.tsx`/`VocabQuiz.tsx` を `resolveTemplate` の vocab属性へ。`StudyPolicy.tsx` を登録Subject走査＋テンプレのstudyPolicyへ（国語は `STUDY_POLICY_EXCLUDED_TEMPLATE_KEYS=["japanese"]` で明示除外）。**`vocabLabels.ts` 削除**（参照ゼロ確認済み）。
- **段階5（Onboarding refactor）**：`OnboardingDraft` version2 化（`subjects: DraftSubject[]{instanceId,templateKey,name,testDate}`、章/vocabは `subjectInstanceId` 参照、`DraftChapter.selfReport`→`achievedLevel`、correctRate撤去）。`OnboardingStepSubjects.tsx` を「テンプレ選択→教科追加（同テンプレ複数可・名前編集・削除）」へ。初期理解度 picker を `AchievementLevelPicker`＋テンプレのラダーへ。`onboardingTypes.ts` の旧定数（`SUBJECT_LABELS`/`SUBJECT_ORDER`/`VOCAB_SUBJECT_KEYS`/`CHAPTER_CAPABLE_SUBJECT_KEYS`/`curriculumSubjectFor`/`SubjectKey`）を**全削除**。`storage.ts` の `loadOnboardingDraft` は version不一致（旧v1下書き）を破棄。

## 段階6（社会の章化＋掃除）完了メモ（2026-07-09）

- `subjectTemplates.ts` の social を `chapterCapable:true` に変更（vocabCapable は true 維持＝D1併存）。これで社会は**英語と同じ chapter+vocab 両対応**の組み合わせになり、UIパスは既に英語で実証済みのため `logic.ts`・onboarding・Settings は無改修で通った。`SOCIAL_LEVELS`（1周=段階2…3周=段階4）は達成段階エンジンが汎用なので章にそのまま乗る（周回の意味づけはラダー表示テキストのみ）。
- **掃除**：`SelfReportPicker.tsx` を削除（import/test/使用箇所ゼロを確認済み）。付随の未使用CSS（`.self-report-picker`/`.sr-option`/`.sr-option.selected`/`.sr-num`/`.sr-text`）も除去。`.subtopic-row .self-report-picker` は現行 subtopic 行が使う `.achievement-level-picker` へ差し替え。`INITIAL_UNDERSTANDING_LABELS` は**既に前段階で削除済み**（src 内に存在せず＝作業不要）。
- **テスト更新**：`Onboarding.test.tsx` の「社会・国語には章の登録セクションが表示されない」を新仕様へ分割（社会は章セクション**表示**＋暗記範囲併存、国語は非表示）。
- **実機QA（Playwright/Chromium, 390x844）**：①レガシー社会（`templateKey` 無し）で起動して落ちない＝名前逆引きで解決 ②社会の設定画面に「＋ 章を追加」が出て章＋暗記範囲が併存表示、を確認。スクショ目視OK。

## 段階7（英語の文法/読解トラック分割）完了メモ（2026-07-09）

ユーザーが「段階7もやる」と明示したため実装（プランでは任意拡張だった）。

- **ラダー**：`studyPolicy.ts` に `ENGLISH_GRAMMAR_LEVELS`（教科書理解 半分=2/全部=3、文法ワーク3回=4）と `ENGLISH_READING_LEVELS`（テスト範囲の長文を等分し1本訳せるごとに1段階）を追加。既存 `ENGLISH_EXTRA_NOTE` の基準をそのままラダー化。トラック解決は `studyLevelsForTrack(base, track)`（track 未設定なら base を返す純粋関数、`SubtopicTrack` 型）。
- **capability**：`SubjectTemplate.trackCapable` を追加（英語のみ true）。名前リテラルではなくテンプレ属性で判定＝テンプレ設計に一貫。
- **記録画面**：選択中の小項目に `track` があればそのトラック専用ラダーへ切り替え（`SessionRecord.tsx` の `studyLevelsForTrack(base, selectedSubtopic?.track)`）。小項目ドロップダウンに「（文法）／（読解）」サフィックス表示。章全体記録・トラック未設定・他教科は基本ラダーのまま。
- **設定/オンボUI**：`trackCapable` の教科の小項目行に「トラック（区別しない/文法/読解）」`<select>` を追加。オンボの初期理解度ピッカーも `st.track` に応じてラダー切替。`DraftSubtopic.track`（`null` 既定）→ 送信変換で `ChapterSubtopic.track` へ引き継ぎ。
- **テスト**：新規 `src/data/studyPolicy.test.ts`（4件）＋`SessionRecord.test.tsx` に文法↔読解ラダー切替の統合テスト1件。計400件全通過。
- **実機QA（Playwright/Chromium）**：①設定で英語小項目にトラック選択が出る ②文法に設定できる ③記録画面で文法ラダーの文言に切り替わる／小項目ラベルが「文法パート（文法）」表示、をスクショ目視で確認。JSエラーなし。
- **未対応（意図的スコープ外）**：勉強方針画面（`StudyPolicy.tsx`）は英語の基本ラダー＋`ENGLISH_EXTRA_NOTE`（文法/読解の基準を文章で説明）のままで、トラック別ラダーの個別表示は未追加。必要なら follow-up。

## 発展問題(advancedProblems)廃止メモ（2026-07-09）

段階7完了後、ユーザーから「小項目ごとに問題数を入力させるのが面倒」という指摘。相談の結果、**発展問題だけを全面廃止・基礎問題と理解度は維持**に決定（ユーザー判断）。理由：①発展問題は「時間が余ったらやる」性格で目標数を数えにくい ②達成段階ラダーの段階5「発展問題が解ける」と二重管理になっていた ③次の単元に進む合格ラインは段階4（＝基礎中心）なので見積もり精度もほぼ落ちない。

- **3か所すべてから発展を除去**：登録時の目標数（オンボ・設定）／記録画面の「解いた発展問題数」／ダッシュボードの発展ペースバッジ。
- **logic.ts**：`estimateSubtopicRemainingMinutes` から advancedMinutes 項を除去、`SubtopicTimeEstimate` から `advancedMinutes` フィールド削除、`LearnedProblemRates` を `basicMinutesPerProblem` のみに、`learnedProblemRates` を基礎のみ学習に簡素化、`MINUTES_PER_ADVANCED_PROBLEM` 削除、`cumulative/recentSubtopicProblemsCompleted` を `number`（基礎のみ）返しに、`SubtopicProblemTiers`/`subtopicProblemTier` を basic のみに。
- **型は後方互換で残置**：`ChapterSubtopic.advancedProblems` / `StudySession.advancedProblemsCompleted` は types.ts に残す（旧データが壊れないため）。読み書きはしない。旧データの advanced 値は見積もりに影響しない（QA確認済み）。
- **達成段階ラダーの段階5「発展問題が解ける」はそのまま**（発展は理解度の段階として存続、数える入力だけ廃止）。
- テスト398件全通過（発展専用テスト2件削除）・build成功・tscクリーン。実機QA（Playwright）：旧データ（advanced含む）で起動して落ちない＋設定/記録/ダッシュボードから発展UIが消えたことを確認。

## 残作業（次セッション）

- **実機QA（教科CRUD全体・未実施の観点）**：`npm run dev`＋可能なら Playwright/Chromium で ①教科新規追加（保健体育）②同教科複製（数学I/数学A別テスト日）③記録で達成段階選択→理解度が段階値になる ④教科削除でカスケード ⑤既存 localStorage（templateKey無し）で起動して落ちない。型/テスト/レビューで見えないUI不具合が過去繰り返し出ているため必須。

## 注意・既知事項
- **`src/components/` の「〜 コピー.tsx」6ファイル**（ChapterCurriculumSuggest/CurriculumSuggest/CurriculumSubtopicPicker の各 .tsx/.test）は未追跡バックアップ。今回も未touch・commit対象外。次回ユーザーに要不要を確認（既存バックログ）。
- japanese テンプレの `studyPolicy` は型を満たすための社会ラダー流用のプレースホルダ（StudyPolicy.tsx では非表示）。国語の勉強方針を正式に作るのは別途。
- 後方互換の要：`Subject.templateKey` は必ず `resolveTemplate`（＋loadData正規化）で吸収。既存ユーザーの5正規教科名は100%解決される。
