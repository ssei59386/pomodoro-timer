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

## 実装進捗（2026-07-09 中断時点）

**段階1〜5 完了。テスト394件全通過・`npm run build` 成功・`npx tsc --noEmit` クリーン。未commit→本引き継ぎでcommit/push予定。**

- **段階1（型＋テンプレ基盤）**：`types.ts`（`Subject.templateKey?`, `StudySession.achievedLevel?`, `correctRate`/`selfReport`任意化, `ChapterSubtopic.track?`）、新規 `subjectTemplates.ts`、`studyPolicy.ts` の `SubjectKey`→`SubjectTemplateKey`、`storage.ts` の loadData で subjects の templateKey 正規化。
- **段階2（logicエンジン）**：上記の達成段階直接セット化＋`sessionObservedUnderstanding`＋`subjectPaceMultiplier` 差し替え。旧エンジンはフォールバックとして残置。
- **段階3（store）**：`addSubject`/`removeSubject`（chapters/sessions/vocabRanges/vocabChunks/forecastDecisions/todayPlan カスケード削除）。ついでに既存 `removeChapter` の forecastDecisions/todayPlan **prune漏れ（実在した）を修正**。共通ヘルパー `pruneForecastDecisions`/`pruneTodayPlan`。
- **段階4（UI capability化）**：新規 `AchievementLevelPicker.tsx`（＋test）。`SessionRecord.tsx` を達成段階選択へ（correctRateスライダー＋SelfReportPicker撤去、初期選択=`round(understanding*5)`）。`Settings.tsx` の日本語名リテラル分岐を全撤去→capability参照＋**教科CRUD UI（追加/改名/削除カスケード確認）**。`Home.tsx`/`VocabQuiz.tsx` を `resolveTemplate` の vocab属性へ。`StudyPolicy.tsx` を登録Subject走査＋テンプレのstudyPolicyへ（国語は `STUDY_POLICY_EXCLUDED_TEMPLATE_KEYS=["japanese"]` で明示除外）。**`vocabLabels.ts` 削除**（参照ゼロ確認済み）。
- **段階5（Onboarding refactor）**：`OnboardingDraft` version2 化（`subjects: DraftSubject[]{instanceId,templateKey,name,testDate}`、章/vocabは `subjectInstanceId` 参照、`DraftChapter.selfReport`→`achievedLevel`、correctRate撤去）。`OnboardingStepSubjects.tsx` を「テンプレ選択→教科追加（同テンプレ複数可・名前編集・削除）」へ。初期理解度 picker を `AchievementLevelPicker`＋テンプレのラダーへ。`onboardingTypes.ts` の旧定数（`SUBJECT_LABELS`/`SUBJECT_ORDER`/`VOCAB_SUBJECT_KEYS`/`CHAPTER_CAPABLE_SUBJECT_KEYS`/`curriculumSubjectFor`/`SubjectKey`）を**全削除**。`storage.ts` の `loadOnboardingDraft` は version不一致（旧v1下書き）を破棄。

## 残作業（次セッション）

- **段階6（社会の章化＋掃除）**：`subjectTemplates.ts` の social テンプレを `chapterCapable:true` へ（vocabCapable は true 維持＝D1併存）。`SOCIAL_LEVELS`（1周=段階2…3周=段階4）が章＋周回でそのまま乗る。**未使用になったコードの掃除**：`SelfReportPicker.tsx`（段階4/5でどこからも呼ばれなくなった。削除可否を確認して削除）、`INITIAL_UNDERSTANDING_LABELS`（onboardingTypes、未使用なら削除）。社会章化で既存テスト/capability前提が変わらないか確認。
- **段階7（任意拡張・要ユーザー確認）**：英語の文法/読解トラック分割。`ChapterSubtopic.track?:"grammar"|"reading"`（型は段階1で追加済み）＋`studyPolicy.ts` に `ENGLISH_READING_LEVELS`/`ENGLISH_GRAMMAR_LEVELS`＋記録画面が track でラダー切替＋オンボ/設定で track 設定UI。**複雑度が高いので着手前にユーザーへ「今やるか」確認**（プランでは任意拡張として切り出した）。
- **実機QA（未実施）**：`npm run dev`＋可能なら Playwright/Chromium で ①教科新規追加（保健体育）②同教科複製（数学I/数学A別テスト日）③記録で達成段階選択→理解度が段階値になる ④教科削除でカスケード ⑤既存 localStorage（templateKey無し）で起動して落ちない。型/テスト/レビューで見えないUI不具合が過去繰り返し出ているため必須。

## 注意・既知事項
- **`src/components/` の「〜 コピー.tsx」6ファイル**（ChapterCurriculumSuggest/CurriculumSuggest/CurriculumSubtopicPicker の各 .tsx/.test）は未追跡バックアップ。今回も未touch・commit対象外。次回ユーザーに要不要を確認（既存バックログ）。
- japanese テンプレの `studyPolicy` は型を満たすための社会ラダー流用のプレースホルダ（StudyPolicy.tsx では非表示）。国語の勉強方針を正式に作るのは別途。
- 後方互換の要：`Subject.templateKey` は必ず `resolveTemplate`（＋loadData正規化）で吸収。既存ユーザーの5正規教科名は100%解決される。
