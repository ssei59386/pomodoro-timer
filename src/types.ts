// 仕様書 §5 データモデル（最小版）

/** 教科 */
export interface Subject {
  id: string;
  /** "数学" / "理科"（Phase 0 はこの2教科のみ） */
  name: string;
  /** この教科の定期テスト実施日（ISO 8601 の日付文字列 "YYYY-MM-DD"） */
  testDate: string;
}

/** 章 ＝ 理解度管理の最小単位 */
export interface Chapter {
  id: string;
  subjectId: string;
  /** 章/単元名（例：「二次関数」） */
  name: string;
  /** この章のテスト配点（点）。最適化の重み */
  pointWeight: number;
  /** 現在の推定理解度（0.0〜1.0） */
  understanding: number;
  /** 目標理解度（既定 0.8） */
  targetUnderstanding: number;
  /** 最後に学習した日（最小版では表示用。減衰は Phase 2） */
  lastStudiedDate: string | null;
  /** 2階層構造の余地（Phase 0 では未使用） */
  skills?: string[];
}

/** 学習セッションの記録ログ */
export interface StudySession {
  id: string;
  chapterId: string;
  /** 実施日（ISO 8601 の日付文字列） */
  date: string;
  /** かけた時間（分） */
  minutes: number;
  /** 演習の正答率（0.0〜1.0） */
  correctRate: number;
  /** 手応えの自己申告（1〜5の5段階） */
  selfReport: number;
}

/** 勉強できる時間の設定 */
export interface AvailabilitySettings {
  /** 1日に勉強に使える時間（分）。最小版は一律 */
  dailyMinutes: number;
}

/** アプリ全体の永続化データ */
export interface AppData {
  subjects: Subject[];
  chapters: Chapter[];
  sessions: StudySession[];
  availability: AvailabilitySettings;
  /** オンボーディング完了フラグ */
  onboarded: boolean;
}
