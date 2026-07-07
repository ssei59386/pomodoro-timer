// 仕様書 §5 データモデル（最小版）

/** 教科 */
export interface Subject {
  id: string;
  /** "数学" / "理科"（Phase 0 はこの2教科のみ） */
  name: string;
  /** この教科の定期テスト実施日（ISO 8601 の日付文字列 "YYYY-MM-DD"） */
  testDate: string;
}

/** 章の学習メタデータ（演習問題数、学習範囲、難易度など） */
export interface ChapterMetadata {
  /** 教科書・ワークの演習問題数 */
  exerciseCount?: number;
  /** 学習範囲の説明（例：「第3章1節〜2節」） */
  learningScope?: string;
  /** 難易度レベル（1: 簡単, 2: 中程度, 3: 難しい） */
  difficultyLevel?: number;
}

/**
 * 章・小項目が「理解を目指す（理解度ラダーを上げにいく）」のか「暗記に切り替えた（深い理解を
 * 諦め、解き方・訳文を丸暗記する）」のかを表す（後悔防止トリガー機能、Phase 2、
 * docs/feature-study-policy.md）。未設定（undefined）は 'understand' 扱い。
 */
export type StudyMode = "understand" | "memorize";

/**
 * 章内の小項目。
 * 元々は名前のみの情報管理（学習範囲を見返すための一覧）だったが、
 * 「見通し」機能フェーズ1で小項目単位の理解度追跡・所要時間見積もりに対応するため、
 * 以下のフィールドをすべて optional で追加した（未設定の既存データはロジック側でフォールバックする）。
 */
export interface ChapterSubtopic {
  id: string;
  name: string;
  /** 小項目の現在の推定理解度（0.0〜1.0）。章を持つ理解度追跡はこちらが正 */
  understanding?: number;
  /** 小項目の目標理解度。未設定なら親 Chapter の targetUnderstanding にフォールバック */
  targetUnderstanding?: number;
  /** 最後にこの小項目を学習した日（忘却曲線の減衰計算に使用） */
  lastStudiedDate?: string | null;
  /** 基礎問題数（教科書の例題＋問題集の基礎レベル問題の合計） */
  basicProblems?: number;
  /** 発展問題数（教科書＋問題集の発展レベル問題の合計） */
  advancedProblems?: number;
  /** カリキュラム参考データとの一致で自動入力される難易度（5段階）。手動上書き可 */
  difficultyLevel?: 1 | 2 | 3 | 4 | 5;
  /** 先生からテストに出るヒント（言及・強調など）があったかどうか。優先度計算にボーナスを与える */
  teacherHinted?: boolean;
  /** 後悔防止トリガーで「切り替える」を選んだ結果（Phase 2）。未設定は 'understand' 扱い */
  studyMode?: StudyMode;
}

/** 章 ＝ 理解度管理の最小単位 */
export interface Chapter {
  id: string;
  subjectId: string;
  /** 章/単元名（例：「二次関数」） */
  name: string;
  /** 現在の推定理解度（0.0〜1.0） */
  understanding: number;
  /** 目標理解度（既定 0.8） */
  targetUnderstanding: number;
  /** 最後に学習した日（忘却曲線の減衰計算にも使用。logic.ts の decayedUnderstanding を参照） */
  lastStudiedDate: string | null;
  /** 2階層構造の余地（Phase 0 では未使用） */
  skills?: string[];
  /** 学習メタデータ（演習問題数、学習範囲、難易度など） */
  metadata?: ChapterMetadata;
  /** 小項目（名前のみ。理解度追跡やセッション記録とは連動しない情報管理用） */
  subtopics?: ChapterSubtopic[];
  /**
   * 後悔防止トリガーで「切り替える」を選んだ結果（Phase 2）。この章が小項目を持つ場合、
   * 各小項目の studyMode（ChapterSubtopic.studyMode）が優先され、こちらは使われない
   * （小項目が無い章のみが対象）。未設定は 'understand' 扱い。
   */
  studyMode?: StudyMode;
}

/** 学習セッションの記録ログ */
export interface StudySession {
  id: string;
  chapterId: string;
  /** 章に小項目がある場合、対象の小項目ID（フェーズ2以降で実際に書き込まれる。フェーズ1では型のみ追加） */
  subtopicId?: string;
  /** 実施日（ISO 8601 の日付文字列） */
  date: string;
  /** かけた時間（分） */
  minutes: number;
  /** 演習の正答率（0.0〜1.0） */
  correctRate: number;
  /** 手応えの自己申告（1〜5の5段階） */
  selfReport: number;
  /** このセッションで解いた問題数（任意、基礎/発展の内訳は問わない）。章全体として記録したセッション用 */
  problemsCompleted?: number;
  /** 小項目を指定したセッションでの、基礎問題を解いた数（任意） */
  basicProblemsCompleted?: number;
  /** 小項目を指定したセッションでの、発展問題を解いた数（任意） */
  advancedProblemsCompleted?: number;
}

/** 空き時間帯（"HH:mm" 形式） */
export interface TimeSlot {
  start: string;
  end: string;
}

/**
 * 勉強できる時間の設定。
 * 曜日（0=日, 1=月, ... 6=土）ごとに空き時間帯を持ち、毎週繰り返す前提で計算する。
 * 将来 Google カレンダー等から自動取得する場合も、日付ごとの空き時間帯という
 * 同じ形に変換して渡せるよう、入力元（手動 / カレンダー）と計算ロジックを分けてある。
 */
export interface AvailabilitySettings {
  weeklySchedule: Partial<Record<number, TimeSlot[]>>;
  /** 特定の日だけ曜日設定と異なる空き時間にしたい場合の上書き（ISO日付文字列 → 時間帯） */
  dateOverrides: Record<string, TimeSlot[]>;
}

/**
 * 英単語暗記の範囲登録（確定設計 v2、docs/feature-memorization.md 参照）。
 * 単語の意味テキストは一切保存せず、単語帳の見出し番号／教科書レッスン内の通し番号という
 * 「番号」だけで個々の単語を識別する。
 */
export interface VocabRange {
  id: string;
  subjectId: string;
  /** 例:「ターゲット1900」 */
  label: string;
  /** 教科書レッスンに紐づく場合のみ設定（未設定なら単語帳扱い） */
  chapterId?: string;
  startNumber: number;
  endNumber: number;
}

/**
 * 単語帳・レッスン内の固定20語ずつの「枠」に対応する学習アイテム（確定設計 v3、
 * docs/feature-memorization.md 参照）。意味テキストは持たない。
 * 単語1つずつではなく枠単位でLeitner方式（箱1〜5、logic.ts の VOCAB_BOX_INTERVAL_DAYS）を
 * 適用する。理解度の段階評価は持ち込まず、枠の状態は「復習継続中」か「完了（completed）」の
 * 二値のみで管理する。
 */
export interface VocabChunk {
  id: string;
  rangeId: string;
  /** 枠の開始番号（範囲内の通し番号） */
  startNumber: number;
  /** 枠の終了番号（範囲内の通し番号） */
  endNumber: number;
  /** 学習に着手済みか */
  introduced: boolean;
  /** 0=未着手、1〜5=Leitnerの箱 */
  box: 0 | 1 | 2 | 3 | 4 | 5;
  /** 次回の復習予定日（ISO日付）。未着手なら null */
  nextReviewDate: string | null;
  /** 生徒が「完璧になった」と明示的に報告したか。true になった枠は出題対象から外れる */
  completed: boolean;
}

/**
 * 後悔防止トリガー（Phase 2、docs/feature-study-policy.md）の、章/小項目1件ぶんの追跡状態。
 * キーは logic.ts の forecastDecisionKey(chapterId, subtopicId) で作る合成キー。
 */
export interface ForecastDecisionState {
  /** 前向きシミュレーションで「不足あり」と判定された連続日数 */
  shortfallStreak: number;
  /** 直近に評価した日（同日の二重カウント防止に使う。"YYYY-MM-DD"） */
  lastEvaluatedDate: string;
  /** 「続ける」を選んだ結果の再確認抑制日（この日以降に再評価する。"YYYY-MM-DD"、未設定なら抑制なし） */
  snoozeUntilDate?: string;
}

/** アプリ全体の永続化データ */
export interface AppData {
  subjects: Subject[];
  chapters: Chapter[];
  sessions: StudySession[];
  availability: AvailabilitySettings;
  vocabRanges: VocabRange[];
  vocabChunks: VocabChunk[];
  /**
   * 「今日の計画」の固定スナップショット（対象の章/小項目の集合のみ）。
   * 日をまたぐまでは同じ集合を使い続け、1件記録するたびに次善の項目が
   * 自動で滑り込んでくる（＝いつまでも0件にならない）挙動を防ぐ。
   * 割当分数・理由チップはここには持たず、表示のたびに最新の章データから再計算する
   * （logic.ts の buildPlanFromItemKeys）。未生成なら null。
   */
  todayPlan: { date: string; itemKeys: { chapterId: string; subtopicId: string | null }[] } | null;
  /**
   * 後悔防止トリガー（Phase 2）の追跡状態。キーは logic.ts の forecastDecisionKey(chapterId, subtopicId)。
   * 章を持つ教科（数学・理科・英語）のみが対象（社会は章を持たないため対象外）。
   */
  forecastDecisions?: Record<string, ForecastDecisionState>;
  /** オンボーディング完了フラグ */
  onboarded: boolean;
}
