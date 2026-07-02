// 仕様書 §6 コアロジック（最小版）。すべて純粋関数として実装する。
import type { AvailabilitySettings, Chapter, ChapterSubtopic, StudySession, Subject, TimeSlot } from "./types";

// ---- 調整可能な定数 ----------------------------------------------------

/** 観測値の合成比率：客観（正答率）を重め、主観（自己申告）を軽め（§6.1） */
export const OBSERVED_CORRECT_WEIGHT = 0.7;
export const OBSERVED_SELF_WEIGHT = 0.3;

/** 平滑化係数 α（§6.1）。1回の結果で急変させない */
export const SMOOTHING_ALPHA = 0.5;

/** 目標理解度の既定値（§5） */
export const DEFAULT_TARGET_UNDERSTANDING = 0.8;

/** 1セッションあたりの目安時間（分）。1章集中（§6.3） */
export const SESSION_MINUTES = 45;

/** 忘却曲線の半減期（日）。最後に学習した日からこの日数経つと理解度が半分に減衰する */
export const FORGETTING_HALF_LIFE_DAYS = 21;

// ---- §6.1 理解度の更新 -------------------------------------------------

/**
 * 今回のセッションから観測理解度を算出する。
 * observed = 0.7 × correctRate + 0.3 × (selfReport / 5)
 */
export function computeObserved(correctRate: number, selfReport: number): number {
  return OBSERVED_CORRECT_WEIGHT * correctRate + OBSERVED_SELF_WEIGHT * (selfReport / 5);
}

/**
 * 平滑化して理解度を更新する。
 * understanding_new = α × observed + (1 − α) × understanding_old
 */
export function updateUnderstanding(oldUnderstanding: number, observed: number): number {
  const next = SMOOTHING_ALPHA * observed + (1 - SMOOTHING_ALPHA) * oldUnderstanding;
  return clamp01(next);
}

/**
 * 初回（まだセッションが無い章）の初期理解度。
 * 5段階の自己申告（1〜5）をそのまま 0.0〜1.0 にマップする。
 */
export function selfReportToInitialUnderstanding(selfReport: number): number {
  return clamp01(selfReport / 5);
}

/**
 * 初期理解度を算出する。直近の正答率（任意）があれば §6.1 と同じ重みで自己申告と合成し、
 * 無ければ自己申告のみで決める。
 */
export function computeInitialUnderstanding(selfReport: number, correctRate?: number): number {
  if (correctRate === undefined) return selfReportToInitialUnderstanding(selfReport);
  return clamp01(computeObserved(correctRate, selfReport));
}

/**
 * 章を小項目（任意・2〜4個程度）に分けて自己申告した場合、その平均から章の初期理解度を算出する。
 */
export function averageInitialUnderstanding(selfReports: number[]): number {
  const sum = selfReports.reduce((acc, v) => acc + selfReportToInitialUnderstanding(v), 0);
  return clamp01(sum / selfReports.length);
}

// ---- §6.2 優先度スコア -------------------------------------------------

/** テスト日が今日より前（過去）かどうか。日付入力のバリデーションに使う */
export function isPastDate(isoDate: string, today: Date): boolean {
  return parseDate(isoDate).getTime() < startOfDay(today).getTime();
}

/** テストまでの残り日数（最低 1 日） */
export function daysLeft(testDate: string, today: Date): number {
  const test = parseDate(testDate);
  const diffMs = test.getTime() - startOfDay(today).getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(days, 1);
}

/**
 * テストまでの近さ係数。テストが近いほど大きい。
 * proximity = 1 / daysLeft（暫定版・調整可能。後で対数等に差し替え可能なよう関数化）
 */
export function proximity(testDate: string, today: Date): number {
  return 1 / daysLeft(testDate, today);
}

/**
 * 優先度スコア（§6.2）。
 * priority = pointWeight × max(target − understanding, 0) × proximity
 */
export function priority(chapter: Chapter, subject: Subject, today: Date): number {
  const currentUnderstanding = decayedUnderstanding(chapter, today);
  const gap = Math.max(chapter.targetUnderstanding - currentUnderstanding, 0);
  return chapter.pointWeight * gap * proximity(subject.testDate, today);
}

/**
 * 忘却曲線を適用した「現在の」推定理解度。最後に学習した日からの経過日数に応じて
 * 指数的に減衰させる（read-time のみの計算。chapter.understanding 自体は変更しない）。
 */
export function decayedUnderstanding(chapter: Chapter, today: Date): number {
  if (!chapter.lastStudiedDate) return chapter.understanding;
  const days = daysSince(chapter.lastStudiedDate, today);
  if (days <= 0) return chapter.understanding;
  const decayFactor = Math.pow(0.5, days / FORGETTING_HALF_LIFE_DAYS);
  return clamp01(chapter.understanding * decayFactor);
}

// ---- 勉強できる時間（曜日ごとの空き時間帯から算出） ---------------------

/** 時間帯の長さ（分）。終了が開始より前の場合は 0 とする */
export function slotMinutes(slot: TimeSlot): number {
  const [sh, sm] = slot.start.split(":").map(Number);
  const [eh, em] = slot.end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/** 時間帯が有効か（終了が開始より後で、実際に時間幅があるか）。UI 側の入力検証に使う */
export function isValidTimeSlot(slot: TimeSlot): boolean {
  return slotMinutes(slot) > 0;
}

/**
 * 指定した日に勉強できる時間（分）。
 * その日付の特別設定（dateOverrides）があればそれを優先し、無ければ曜日の既定スケジュールを使う。
 * 将来カレンダー連携に差し替える際も「日付 → 利用可能分数」という同じ形を返せばよいよう、
 * 関数として分離してある。
 */
export function availableMinutesForDate(availability: AvailabilitySettings, date: Date): number {
  const slots = availability.dateOverrides[toISODate(date)] ?? availability.weeklySchedule[date.getDay()] ?? [];
  return slots.reduce((sum, slot) => sum + slotMinutes(slot), 0);
}

// ---- §6.3 計画生成（貪欲法・1章集中） --------------------------------

export interface PlanItem {
  chapter: Chapter;
  subject: Subject;
  /** 割り当てる目安時間（分） */
  allocatedMinutes: number;
  /** この優先度スコア */
  priority: number;
  /** なぜこの章か（簡単な根拠ラベル） */
  reasons: string[];
}

/**
 * 「今日やること」を生成する（§6.3）。
 * 1. 全章の priority を計算
 * 2. priority の高い順に並べる
 * 3. dailyMinutes を上から消化するよう、1章ずつ集中して割り当てる
 *    （章を細切れにしない。時間が余ったら次の章へ）
 */
export function generateTodayPlan(
  chapters: Chapter[],
  subjects: Subject[],
  dailyMinutes: number,
  today: Date,
): PlanItem[] {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const scored = chapters
    .map((chapter) => {
      const subject = subjectById.get(chapter.subjectId);
      if (!subject) return null;
      return { chapter, subject, score: priority(chapter, subject, today) };
    })
    .filter((x): x is { chapter: Chapter; subject: Subject; score: number } => x !== null)
    // 既に目標到達（伸びしろ0）の章は今日やる必要がないので除外
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const plan: PlanItem[] = [];
  let remaining = dailyMinutes;

  for (const { chapter, subject, score } of scored) {
    if (remaining <= 0) break;
    const allocatedMinutes = Math.min(SESSION_MINUTES, remaining);
    plan.push({
      chapter,
      subject,
      allocatedMinutes,
      priority: score,
      reasons: buildReasons(chapter, subject, chapters, today),
    });
    remaining -= allocatedMinutes;
  }

  return plan;
}

/** 「配点高め／理解度が低め／テストが近い」程度の簡単な根拠（§7.2） */
function buildReasons(
  chapter: Chapter,
  subject: Subject,
  allChapters: Chapter[],
  today: Date,
): string[] {
  const reasons: string[] = [];

  const weights = allChapters.map((c) => c.pointWeight);
  const avgWeight = average(weights);
  if (chapter.pointWeight >= avgWeight) {
    reasons.push("配点が高め");
  }

  const currentUnderstanding = decayedUnderstanding(chapter, today);
  if (currentUnderstanding < chapter.targetUnderstanding * 0.75) {
    reasons.push("理解度が低め");
  }

  if (daysLeft(subject.testDate, today) <= 7) {
    reasons.push("テストが近い");
  }

  if (reasons.length === 0) {
    reasons.push("バランス調整");
  }
  return reasons;
}

// ---- セッション適用ヘルパ ---------------------------------------------

/**
 * セッション記録を章に適用し、更新後の章を返す（純粋関数）。
 * 理解度の更新（§6.1）と lastStudiedDate の更新を行う。
 */
export function applySessionToChapter(chapter: Chapter, session: StudySession): Chapter {
  const observed = computeObserved(session.correctRate, session.selfReport);
  return {
    ...chapter,
    understanding: updateUnderstanding(chapter.understanding, observed),
    lastStudiedDate: session.date,
  };
}

/**
 * セッション記録を小項目に適用し、更新後の章を返す（純粋関数）。フェーズ2。
 * 小項目単位の理解度はあくまで subtopic.understanding が正、という設計方針を踏襲し、
 * 章本体の understanding / lastStudiedDate はここでは変更しない。
 * 対象の subtopicId が見つからない場合（subtopics 未設定・該当IDなし）は章をそのまま返す。
 */
export function applySessionToSubtopic(chapter: Chapter, subtopicId: string, session: StudySession): Chapter {
  const subtopics = chapter.subtopics ?? [];
  const index = subtopics.findIndex((s) => s.id === subtopicId);
  if (index === -1) return chapter;

  const observed = computeObserved(session.correctRate, session.selfReport);
  const target = subtopics[index];
  const updatedSubtopic: ChapterSubtopic = {
    ...target,
    understanding: updateUnderstanding(target.understanding ?? 0, observed),
    lastStudiedDate: session.date,
  };

  const updatedSubtopics = [...subtopics];
  updatedSubtopics[index] = updatedSubtopic;

  return {
    ...chapter,
    subtopics: updatedSubtopics,
  };
}

// ---- 「見通し」機能フェーズ1：小項目単位の優先度スコア・所要時間見積もり ----
// 既存の priority / generateTodayPlan / applySessionToChapter / buildReasons は一切変更しない
// （章単位のロジックは今回のフェーズでは無関係、回帰リスクをゼロに保つ設計方針）。

/**
 * 章の配点（pointWeight）を、その章が持つ小項目の間で均等に按分する。
 * 各小項目の按分weightの合計は常に chapter.pointWeight と一致する
 * （章単位のスコアとの比較可能性を保つため）。
 * 小項目が無い/空の章は空の Map を返す。
 */
export function subtopicPointWeights(chapter: Chapter): Map<string, number> {
  const subtopics = chapter.subtopics ?? [];
  const map = new Map<string, number>();
  if (subtopics.length === 0) return map;
  const share = chapter.pointWeight / subtopics.length;
  for (const subtopic of subtopics) {
    map.set(subtopic.id, share);
  }
  return map;
}

/**
 * 忘却曲線を適用した小項目の「現在の」推定理解度（read-time のみの計算）。
 * 章版 decayedUnderstanding と同じ減衰式を使う。
 * understanding 未設定なら 0 として扱い、lastStudiedDate 未設定ならその値をそのまま返す（減衰させない）。
 */
export function decayedSubtopicUnderstanding(subtopic: ChapterSubtopic, today: Date): number {
  const understanding = subtopic.understanding ?? 0;
  if (!subtopic.lastStudiedDate) return understanding;
  const days = daysSince(subtopic.lastStudiedDate, today);
  if (days <= 0) return understanding;
  const decayFactor = Math.pow(0.5, days / FORGETTING_HALF_LIFE_DAYS);
  return clamp01(understanding * decayFactor);
}

/**
 * 小項目版の優先度スコア。章版 priority と同じ形（配点 × 伸びしろ × 近さ）だが、
 * 配点は subtopicPointWeights で按分した値を使う。
 */
export function subtopicPriority(
  chapter: Chapter,
  subtopic: ChapterSubtopic,
  subject: Subject,
  today: Date,
): number {
  const weight = subtopicPointWeights(chapter).get(subtopic.id) ?? 0;
  const target = subtopic.targetUnderstanding ?? chapter.targetUnderstanding;
  const currentUnderstanding = decayedSubtopicUnderstanding(subtopic, today);
  const gap = Math.max(target - currentUnderstanding, 0);
  return weight * gap * proximity(subject.testDate, today);
}

/** 章 or 小項目のどちらを対象にしたスコアかを表す（小項目が無い章は subtopic: null の1件） */
export interface PriorityScoreItem {
  chapter: Chapter;
  /** null なら章レベルのスコア（小項目を持たない章のフォールバック） */
  subtopic: ChapterSubtopic | null;
  subject: Subject;
  score: number;
}

/**
 * 章のスコアを算出する（デュアルパス）。
 * - 小項目が無い/空の章：既存の priority() をそのまま使い、1件配列で返す（後方互換）。
 * - 小項目がある章：各小項目ごとに subtopicPriority() を計算し、小項目数分の配列を返す。
 */
export function scoreChapterOrSubtopics(chapter: Chapter, subject: Subject, today: Date): PriorityScoreItem[] {
  const subtopics = chapter.subtopics ?? [];
  if (subtopics.length === 0) {
    return [{ chapter, subtopic: null, subject, score: priority(chapter, subject, today) }];
  }
  return subtopics.map((subtopic) => ({
    chapter,
    subtopic,
    subject,
    score: subtopicPriority(chapter, subtopic, subject, today),
  }));
}

// ---- 小項目の所要時間見積もり（基礎/発展の2軸） ------------------------

/** 理解度がこの値未満のときだけ「概念学習コスト」を上乗せする（毎回の再計算で重複計上しないよう閾値化） */
export const CONCEPT_LEARNING_COST_MINUTES = 20;
/** 基礎問題1問あたりの目安時間（分） */
export const MINUTES_PER_BASIC_PROBLEM = 3;
/** 発展問題1問あたりの目安時間（分） */
export const MINUTES_PER_ADVANCED_PROBLEM = 6;

/** 理解度がこの値未満なら、まだ概念そのものを学べていないとみなす閾値 */
const CONCEPT_UNDERSTANDING_THRESHOLD = 0.2;

export interface SubtopicTimeEstimate {
  conceptMinutes: number;
  basicMinutes: number;
  advancedMinutes: number;
  totalMinutes: number;
}

/**
 * 小項目の残り所要時間を見積もる。
 * remainingRatio（1 − 減衰後理解度）を基礎/発展それぞれの問題数に掛けて按分する。
 * difficultyLevel はここでは使わない（問題数ベースの見積もりと混在させると二重計上になるため、
 * 今は候補提示用の付随情報にとどめる）。
 */
export function estimateSubtopicRemainingMinutes(subtopic: ChapterSubtopic, today: Date): SubtopicTimeEstimate {
  const currentUnderstanding = decayedSubtopicUnderstanding(subtopic, today);
  const remainingRatio = 1 - currentUnderstanding;
  const conceptMinutes = currentUnderstanding < CONCEPT_UNDERSTANDING_THRESHOLD ? CONCEPT_LEARNING_COST_MINUTES : 0;
  const basicMinutes = (subtopic.basicProblems ?? 0) * MINUTES_PER_BASIC_PROBLEM * remainingRatio;
  const advancedMinutes = (subtopic.advancedProblems ?? 0) * MINUTES_PER_ADVANCED_PROBLEM * remainingRatio;
  return {
    conceptMinutes,
    basicMinutes,
    advancedMinutes,
    totalMinutes: conceptMinutes + basicMinutes + advancedMinutes,
  };
}

// ---- 小さなユーティリティ ---------------------------------------------

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(isoDate: string): Date {
  // "YYYY-MM-DD" をローカル日付の 0:00 として解釈する
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** 指定日からの経過日数（today が指定日より前なら負の値） */
export function daysSince(isoDate: string, today: Date): number {
  const date = parseDate(isoDate);
  const diffMs = startOfDay(today).getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** Date を "YYYY-MM-DD" 文字列に変換する */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
