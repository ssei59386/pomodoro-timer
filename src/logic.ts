// 仕様書 §6 コアロジック（最小版）。すべて純粋関数として実装する。
import type { AvailabilitySettings, Chapter, StudySession, Subject, TimeSlot } from "./types";

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
function daysSince(isoDate: string, today: Date): number {
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
