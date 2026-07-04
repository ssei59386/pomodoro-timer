// 仕様書 §6 コアロジック（最小版）。すべて純粋関数として実装する。
import type {
  AvailabilitySettings,
  Chapter,
  ChapterSubtopic,
  StudySession,
  Subject,
  TimeSlot,
  VocabChunk,
  VocabRange,
} from "./types";

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

// ---- §6.3 計画生成（貪欲法・1章集中 / 小項目がある章は1小項目集中） ------

export interface PlanItem {
  chapter: Chapter;
  /** null なら章レベル（小項目を持たない章のフォールバック） */
  subtopic: ChapterSubtopic | null;
  subject: Subject;
  /** 割り当てる目安時間（分） */
  allocatedMinutes: number;
  /** この優先度スコア */
  priority: number;
  /** なぜこの項目か（簡単な根拠ラベル） */
  reasons: string[];
}

/** 小項目1件あたりの最低割当時間（分）。見積もりが小さすぎて細切れになりすぎるのを防ぐ（暫定値） */
export const MIN_SUBTOPIC_SESSION_MINUTES = 10;

/**
 * 「今日やること」を生成する（§6.3、フェーズ4.5で小項目単位にも対応）。
 * 1. 全章・小項目の優先度スコアを scoreChapterOrSubtopics で計算（デュアルパス）
 * 2. スコアの高い順に並べる
 * 3. dailyMinutes を上から消化するよう割り当てる
 *    - 小項目を持たない章：従来通り章単位で1個・SESSION_MINUTES固定（回帰ゼロを保証するため既存ロジックと完全一致させる）
 *    - 小項目を持つ章：小項目単位で複数個（同じ章の小項目が同日プランに複数並んでよい）、
 *      割当時間は estimateSubtopicRemainingMinutes の見積もりを
 *      [MIN_SUBTOPIC_SESSION_MINUTES, SESSION_MINUTES] にクランプした値
 * sessions は省略可（省略時は learnedProblemRates が実測データ無しとしてデフォルト単価にフォールバックするだけ
 * なので、既存の呼び出し元・既存テストは無変更で動き続ける）。
 */
export function generateTodayPlan(
  chapters: Chapter[],
  subjects: Subject[],
  dailyMinutes: number,
  today: Date,
  sessions: StudySession[] = [],
): PlanItem[] {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const scored = chapters
    .flatMap((chapter) => {
      const subject = subjectById.get(chapter.subjectId);
      if (!subject) return [];
      return scoreChapterOrSubtopics(chapter, subject, today).map((item) => ({
        chapter: item.chapter,
        subtopic: item.subtopic,
        subject,
        score: item.score,
      }));
    })
    // 既に目標到達（伸びしろ0）の章/小項目は今日やる必要がないので除外
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const plan: PlanItem[] = [];
  let remaining = dailyMinutes;
  const ratesCache = new Map<string, LearnedProblemRates>();

  for (const { chapter, subtopic, subject, score } of scored) {
    if (remaining <= 0) break;

    let allocatedMinutes: number;
    let reasons: string[];

    if (subtopic) {
      if (!ratesCache.has(subject.id)) {
        ratesCache.set(subject.id, learnedProblemRates(sessions, chapters, subject.id));
      }
      const rates = ratesCache.get(subject.id)!;
      const estimate = estimateSubtopicRemainingMinutes(subtopic, today, rates).totalMinutes;
      const target = Math.max(MIN_SUBTOPIC_SESSION_MINUTES, Math.min(SESSION_MINUTES, Math.ceil(estimate)));
      allocatedMinutes = Math.min(target, remaining);
      reasons = buildSubtopicReasons(chapter, subtopic, subject, chapters, today);
    } else {
      allocatedMinutes = Math.min(SESSION_MINUTES, remaining);
      reasons = buildReasons(chapter, subject, chapters, today);
    }

    plan.push({ chapter, subtopic, subject, allocatedMinutes, priority: score, reasons });
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

/** 小項目版の「配点高め／理解度が低め／テストが近い／先生のヒントあり」根拠ラベル */
function buildSubtopicReasons(
  chapter: Chapter,
  subtopic: ChapterSubtopic,
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

  const target = subtopic.targetUnderstanding ?? chapter.targetUnderstanding;
  const currentUnderstanding = decayedSubtopicUnderstanding(subtopic, today);
  if (currentUnderstanding < target * 0.75) {
    reasons.push("理解度が低め");
  }

  if (daysLeft(subject.testDate, today) <= 7) {
    reasons.push("テストが近い");
  }

  if (subtopic.teacherHinted) {
    reasons.push("先生のヒントあり");
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
/** 先生からのテストヒントがあった小項目の優先度に掛けるボーナス倍率（暫定値） */
export const TEACHER_HINT_PRIORITY_BOOST = 1.5;

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
  const hintMultiplier = subtopic.teacherHinted ? TEACHER_HINT_PRIORITY_BOOST : 1;
  return weight * gap * proximity(subject.testDate, today) * hintMultiplier;
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
/** 基礎問題1問あたりの目安時間（分）。実測データがまだ十分に貯まっていないときのデフォルト値 */
export const MINUTES_PER_BASIC_PROBLEM = 13;
/** 発展問題1問あたりの目安時間（分）。実測データがまだ十分に貯まっていないときのデフォルト値 */
export const MINUTES_PER_ADVANCED_PROBLEM = 25;

/** 理解度がこの値未満なら、まだ概念そのものを学べていないとみなす閾値 */
const CONCEPT_UNDERSTANDING_THRESHOLD = 0.2;

export interface SubtopicTimeEstimate {
  conceptMinutes: number;
  basicMinutes: number;
  advancedMinutes: number;
  totalMinutes: number;
}

/** これ未満の「純粋な」実測セッション数しか無ければ、まだ学習値を信頼せずデフォルト値を使う（暫定値） */
export const MIN_SESSIONS_FOR_LEARNED_RATE = 3;

export interface LearnedProblemRates {
  basicMinutesPerProblem: number;
  advancedMinutesPerProblem: number;
}

/**
 * 教科ごとに、演習1問あたりの実際にかかった時間を過去のセッション記録から学習する。
 * 「基礎だけ」または「発展だけ」を記録した純粋なセッション（両方が混在するセッションは
 * 時間の内訳が分からないため除外）を対象に、`session.minutes / 完了数` の単純平均を取る。
 * 対象セッションが MIN_SESSIONS_FOR_LEARNED_RATE 件未満なら、まだ学習値を信頼せず
 * MINUTES_PER_BASIC_PROBLEM / MINUTES_PER_ADVANCED_PROBLEM のデフォルト値を返す。
 */
export function learnedProblemRates(
  sessions: StudySession[],
  chapters: Chapter[],
  subjectId: string,
): LearnedProblemRates {
  const chapterIds = new Set(chapters.filter((c) => c.subjectId === subjectId).map((c) => c.id));

  function pureSessions(kind: "basic" | "advanced"): StudySession[] {
    return sessions.filter((s) => {
      if (!s.subtopicId || !chapterIds.has(s.chapterId)) return false;
      const basic = s.basicProblemsCompleted ?? 0;
      const advanced = s.advancedProblemsCompleted ?? 0;
      return kind === "basic" ? basic > 0 && advanced === 0 : advanced > 0 && basic === 0;
    });
  }

  function average(kind: "basic" | "advanced", fallback: number): number {
    const pure = pureSessions(kind);
    if (pure.length < MIN_SESSIONS_FOR_LEARNED_RATE) return fallback;
    const key = kind === "basic" ? "basicProblemsCompleted" : "advancedProblemsCompleted";
    const rates = pure.map((s) => s.minutes / (s[key] ?? 1));
    return rates.reduce((a, b) => a + b, 0) / rates.length;
  }

  return {
    basicMinutesPerProblem: average("basic", MINUTES_PER_BASIC_PROBLEM),
    advancedMinutesPerProblem: average("advanced", MINUTES_PER_ADVANCED_PROBLEM),
  };
}

/**
 * 小項目の残り所要時間を見積もる。
 * remainingRatio（1 − 減衰後理解度）を基礎/発展それぞれの問題数に掛けて按分する。
 * difficultyLevel はここでは使わない（問題数ベースの見積もりと混在させると二重計上になるため、
 * 今は候補提示用の付随情報にとどめる）。
 * rates を省略した場合はデフォルト値（MINUTES_PER_BASIC_PROBLEM / MINUTES_PER_ADVANCED_PROBLEM）を使う。
 */
export function estimateSubtopicRemainingMinutes(
  subtopic: ChapterSubtopic,
  today: Date,
  rates: LearnedProblemRates = {
    basicMinutesPerProblem: MINUTES_PER_BASIC_PROBLEM,
    advancedMinutesPerProblem: MINUTES_PER_ADVANCED_PROBLEM,
  },
): SubtopicTimeEstimate {
  const currentUnderstanding = decayedSubtopicUnderstanding(subtopic, today);
  const remainingRatio = 1 - currentUnderstanding;
  const conceptMinutes = currentUnderstanding < CONCEPT_UNDERSTANDING_THRESHOLD ? CONCEPT_LEARNING_COST_MINUTES : 0;
  const basicMinutes = (subtopic.basicProblems ?? 0) * rates.basicMinutesPerProblem * remainingRatio;
  const advancedMinutes = (subtopic.advancedProblems ?? 0) * rates.advancedMinutesPerProblem * remainingRatio;
  return {
    conceptMinutes,
    basicMinutes,
    advancedMinutes,
    totalMinutes: conceptMinutes + basicMinutes + advancedMinutes,
  };
}

// ---- 「見通し」機能フェーズ4：実績ベースのペース判定 ----

export type ProgressTier = "on_track" | "slightly_behind" | "at_risk";

export const PROGRESS_TIER_LABELS: Record<ProgressTier, string> = {
  on_track: "順調",
  slightly_behind: "やや遅れ",
  at_risk: "要注意",
};

/** 「直近」とみなす日数（暫定値・調整可能） */
export const RECENT_ACTIVITY_WINDOW_DAYS = 7;
/** このギャップ以下なら、直近取り組みが無くても on_track とみなす（暫定値） */
const UNDERSTANDING_GAP_ON_TRACK = 0.15;
/** このギャップを超えたら、直近取り組みがあっても at_risk とみなす（暫定値） */
const UNDERSTANDING_GAP_AT_RISK = 0.35;
/** 直近実績 ÷ 本来必要な週次ペース がこの比率以上なら on_track（暫定値） */
const PROBLEM_PACE_ON_TRACK_RATIO = 1.0;
/** この比率以上なら slightly_behind、未満なら at_risk（暫定値） */
const PROBLEM_PACE_SLIGHT_RATIO = 0.5;
/**
 * 残りこの日数以下になったら演習ペース判定自体を行わない（暫定値）。
 * テスト直前は weeksLeft が極小化して requiredPerWeek が跳ね上がり、
 * 直近7日の実績と比べてほぼ確実に at_risk になってしまう
 * （詰め込み期に無用な焦りを与えるだけの警告になるため、判定不可＝nullとして扱う）。
 */
const PROBLEM_TIER_MIN_DAYS_LEFT = 3;

/** 指定した小項目IDに紐づくセッションだけを抽出する */
export function sessionsForSubtopic(sessions: StudySession[], subtopicId: string): StudySession[] {
  return sessions.filter((s) => s.subtopicId === subtopicId);
}

/** その小項目のセッションで、これまでに解いた基礎/発展問題数の累計 */
export function cumulativeSubtopicProblemsCompleted(
  sessions: StudySession[],
  subtopicId: string,
): { basic: number; advanced: number } {
  const target = sessionsForSubtopic(sessions, subtopicId);
  return target.reduce(
    (acc, s) => ({
      basic: acc.basic + (s.basicProblemsCompleted ?? 0),
      advanced: acc.advanced + (s.advancedProblemsCompleted ?? 0),
    }),
    { basic: 0, advanced: 0 },
  );
}

/** 直近 days 日以内（today を含む）に解いた基礎/発展問題数の合計 */
export function recentSubtopicProblemsCompleted(
  sessions: StudySession[],
  subtopicId: string,
  today: Date,
  days: number = RECENT_ACTIVITY_WINDOW_DAYS,
): { basic: number; advanced: number } {
  const target = sessionsForSubtopic(sessions, subtopicId).filter((s) => {
    const elapsed = daysSince(s.date, today);
    return elapsed >= 0 && elapsed <= days;
  });
  return target.reduce(
    (acc, s) => ({
      basic: acc.basic + (s.basicProblemsCompleted ?? 0),
      advanced: acc.advanced + (s.advancedProblemsCompleted ?? 0),
    }),
    { basic: 0, advanced: 0 },
  );
}

/** 直近 days 日以内に、その小項目のセッションが1件でも記録されているか */
export function hasRecentSubtopicActivity(
  sessions: StudySession[],
  subtopicId: string,
  today: Date,
  days: number = RECENT_ACTIVITY_WINDOW_DAYS,
): boolean {
  return sessionsForSubtopic(sessions, subtopicId).some((s) => {
    const elapsed = daysSince(s.date, today);
    return elapsed >= 0 && elapsed <= days;
  });
}

/**
 * 理解度の到達度ティア。
 * ギャップが小さければ直近の取り組み有無に関わらず on_track。
 * ギャップが中程度なら、直近に取り組んでいれば slightly_behind、そうでなければ at_risk。
 * ギャップが大きければ無条件に at_risk。
 * ただし、その小項目にセッションが一度も記録されていない場合（登録直後で
 * 「まだ何もしていないだけ」の可能性と、実際に取り組んで遅れているケースを区別できないため）は、
 * 悪いほうには倒さず at_risk を slightly_behind に読み替える。
 */
export function subtopicUnderstandingTier(
  chapter: Chapter,
  subtopic: ChapterSubtopic,
  sessions: StudySession[],
  today: Date,
): ProgressTier {
  const target = subtopic.targetUnderstanding ?? chapter.targetUnderstanding;
  const gap = Math.max(0, target - decayedSubtopicUnderstanding(subtopic, today));
  if (gap <= UNDERSTANDING_GAP_ON_TRACK) return "on_track";
  const hasAnySession = sessionsForSubtopic(sessions, subtopic.id).length > 0;
  const recentlyActive = hasRecentSubtopicActivity(sessions, subtopic.id, today);
  if (gap <= UNDERSTANDING_GAP_AT_RISK && recentlyActive) return "slightly_behind";
  if (!hasAnySession) return "slightly_behind";
  return "at_risk";
}

export interface SubtopicProblemTiers {
  /** 基礎問題数が未設定（0/undefined）なら null（判定不可） */
  basic: ProgressTier | null;
  /** 発展問題数が未設定（0/undefined）なら null（判定不可） */
  advanced: ProgressTier | null;
}

/**
 * 演習消化ペースのティア（基礎/発展それぞれ）。
 * 「残り問題数 ÷ テストまでの残り週数」で本来必要な週次ペースを算出し、
 * 直近 RECENT_ACTIVITY_WINDOW_DAYS 日の実績と比較する。
 * ただし、その小項目にセッションが一度も記録されていない場合（登録直後で
 * 直近7日の実績が構造的に必ず0になり、テストまでの日数に関わらずほぼ確実に
 * at_risk 判定になってしまうため）は、悪いほうには倒さず at_risk を
 * slightly_behind に読み替える（subtopicUnderstandingTier と同じ考え方）。
 */
export function subtopicProblemTier(
  subtopic: ChapterSubtopic,
  sessions: StudySession[],
  testDate: string,
  today: Date,
): SubtopicProblemTiers {
  if (daysLeft(testDate, today) <= PROBLEM_TIER_MIN_DAYS_LEFT) {
    return { basic: null, advanced: null };
  }
  const weeksLeft = daysLeft(testDate, today) / 7;
  const cumulative = cumulativeSubtopicProblemsCompleted(sessions, subtopic.id);
  const recent = recentSubtopicProblemsCompleted(sessions, subtopic.id, today);
  const hasAnySession = sessionsForSubtopic(sessions, subtopic.id).length > 0;

  function tierFor(targetCount: number | undefined, done: number, recentDone: number): ProgressTier | null {
    if (!targetCount || targetCount <= 0) return null;
    const remaining = Math.max(0, targetCount - done);
    if (remaining <= 0) return "on_track";
    const requiredPerWeek = remaining / weeksLeft;
    const ratio = recentDone / requiredPerWeek;
    if (ratio >= PROBLEM_PACE_ON_TRACK_RATIO) return "on_track";
    if (ratio >= PROBLEM_PACE_SLIGHT_RATIO) return "slightly_behind";
    if (!hasAnySession) return "slightly_behind";
    return "at_risk";
  }

  return {
    basic: tierFor(subtopic.basicProblems, cumulative.basic, recent.basic),
    advanced: tierFor(subtopic.advancedProblems, cumulative.advanced, recent.advanced),
  };
}

/** 複数ティア（null混じり）の中で最も悪いものを返す。全て null なら null */
export function worstProgressTier(tiers: (ProgressTier | null)[]): ProgressTier | null {
  const severity: Record<ProgressTier, number> = { on_track: 0, slightly_behind: 1, at_risk: 2 };
  const present = tiers.filter((t): t is ProgressTier => t !== null);
  if (present.length === 0) return null;
  return present.reduce((worst, t) => (severity[t] > severity[worst] ? t : worst));
}

// ---- 「見通し」機能フェーズ5：前向きシミュレーション・トリアージ ----
// 小項目を持たない章は対象外（残り所要分という概念が無いため。generateTodayPlan は
// そういう章を固定45分/日の繰り返しとしてモデル化しており、代用値を作ると
// デュアルパス設計が壊れ「一生終わらない章」が常にトリアージ最下位に居座るノイズになる）。
// 内部状態は各小項目の「残り所要分（分）」というスカラーのみ。today 時点で一度だけ
// estimateSubtopicRemainingMinutes を評価してスナップショットし、以降は日ごとに
// 割り当てた分を引くだけ。未来日で decayedSubtopicUnderstanding を再計算・再見積もりは
// 絶対にしない（勉強しない日ほど decay で残り所要分が増える、という負のフィードバックループを
// 避けるため）。これは generateTodayPlan が未来日の decay を一切見ないことと一貫している。

export interface SubtopicForecast {
  chapterId: string;
  subtopicId: string;
  subjectId: string;
  /** day 0（today）時点で見積もった、この小項目を終えるのに必要な総分数 */
  totalMinutesNeeded: number;
  /** テスト日までに終わる見込みの日付（ISO 8601）。間に合わない場合は null */
  projectedCompletionDate: string | null;
  /** テスト日までに割り当てきれなかった分数（間に合う場合は 0） */
  shortfallMinutes: number;
  onTrack: boolean;
}

export interface SubjectForecastSummary {
  subjectId: string;
  totalShortfallMinutes: number;
  atRiskSubtopicIds: string[];
}

export interface ForwardSimulationResult {
  subtopics: SubtopicForecast[];
  subjects: SubjectForecastSummary[];
}

/** シミュレーション内部だけで使う可変ワーキングオブジェクト（外部には公開しない） */
interface ForecastTrackedItem {
  chapter: Chapter;
  subtopic: ChapterSubtopic;
  subject: Subject;
  totalMinutesNeeded: number;
  remainingMinutes: number;
  completionDate: string | null;
}

/**
 * 今日から最も遅いテスト日まで、日ごとに貪欲割当をシミュレートし、
 * 各小項目（小項目を持つ章のみ対象）がいつ終わるか／テスト日に間に合うかを予測する。
 * 本質的には generateTodayPlan の貪欲ループを、もう1段の日ループで包んだだけ
 * （汎用シミュレーションエンジンの抽象化は作らない）。
 * 教科をまたいで1つの候補集合として優先度順に割り当てるが、ある教科は自分の
 * テスト日を過ぎた時点でその集合から脱落する（教科ごとの締切が共有の日々を奪い合う）。
 */
export function simulateForward(
  chapters: Chapter[],
  subjects: Subject[],
  availability: AvailabilitySettings,
  today: Date,
  sessions: StudySession[] = [],
): ForwardSimulationResult {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const ratesCache = new Map<string, LearnedProblemRates>();

  const items: ForecastTrackedItem[] = [];
  for (const chapter of chapters) {
    const subject = subjectById.get(chapter.subjectId);
    if (!subject) continue;
    const subtopics = chapter.subtopics ?? [];
    if (subtopics.length === 0) continue; // 小項目を持たない章は対象外

    if (!ratesCache.has(subject.id)) {
      ratesCache.set(subject.id, learnedProblemRates(sessions, chapters, subject.id));
    }
    const rates = ratesCache.get(subject.id)!;

    for (const subtopic of subtopics) {
      const totalMinutesNeeded = estimateSubtopicRemainingMinutes(subtopic, today, rates).totalMinutes;
      items.push({
        chapter,
        subtopic,
        subject,
        totalMinutesNeeded,
        remainingMinutes: totalMinutesNeeded,
        completionDate: totalMinutesNeeded <= 0 ? toISODate(today) : null,
      });
    }
  }

  if (items.length > 0) {
    let cursor = startOfDay(today);
    const maxTestDate = items.reduce((max, item) => {
      const testDate = parseDate(item.subject.testDate);
      return testDate.getTime() > max.getTime() ? testDate : max;
    }, cursor);

    while (cursor.getTime() <= maxTestDate.getTime()) {
      const dayDate = cursor;
      const eligible = items.filter(
        (item) => item.remainingMinutes > 0 && !isPastDate(item.subject.testDate, dayDate),
      );

      if (eligible.length > 0) {
        let remainingBudget = availableMinutesForDate(availability, dayDate);
        const sorted = eligible
          .map((item) => ({ item, score: subtopicPriority(item.chapter, item.subtopic, item.subject, dayDate) }))
          .sort((a, b) => b.score - a.score);

        for (const { item } of sorted) {
          if (remainingBudget <= 0) break;
          // 既存の [MIN_SUBTOPIC_SESSION_MINUTES, SESSION_MINUTES] クランプに加え、
          // この小項目自身の残り分にもクランプ（完了を超えて過剰割当しない）
          const target = Math.max(MIN_SUBTOPIC_SESSION_MINUTES, Math.min(SESSION_MINUTES, item.remainingMinutes));
          const cappedByOwnRemaining = Math.min(target, item.remainingMinutes);
          const allocation = Math.min(cappedByOwnRemaining, remainingBudget);
          if (allocation <= 0) continue;

          item.remainingMinutes -= allocation;
          remainingBudget -= allocation;
          if (item.remainingMinutes <= 0 && item.completionDate === null) {
            item.completionDate = toISODate(dayDate);
          }
        }
      }

      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  }

  const subtopicForecasts: SubtopicForecast[] = items.map((item) => {
    const onTrack = item.completionDate !== null;
    return {
      chapterId: item.chapter.id,
      subtopicId: item.subtopic.id,
      subjectId: item.subject.id,
      totalMinutesNeeded: item.totalMinutesNeeded,
      projectedCompletionDate: item.completionDate,
      shortfallMinutes: onTrack ? 0 : item.remainingMinutes,
      onTrack,
    };
  });

  const subjectIds = Array.from(new Set(items.map((item) => item.subject.id)));
  const subjectSummaries: SubjectForecastSummary[] = subjectIds.map((subjectId) => {
    const own = subtopicForecasts.filter((f) => f.subjectId === subjectId);
    return {
      subjectId,
      totalShortfallMinutes: own.reduce((sum, f) => sum + f.shortfallMinutes, 0),
      atRiskSubtopicIds: own.filter((f) => !f.onTrack).map((f) => f.subtopicId),
    };
  });

  return { subtopics: subtopicForecasts, subjects: subjectSummaries };
}

/** シミュレーション結果から「切る候補」として並べた1件 */
export interface TriageCandidate {
  chapterId: string;
  subtopicId: string;
  subjectId: string;
  /**
   * 配点按分 ÷ totalMinutesNeeded（残り総所要時間）。値が小さいほど「時間対効果が悪い」＝切る候補として優先度が高い。
   * 分母は shortfallMinutes ではなく totalMinutesNeeded（設計ドキュメント準拠）。
   * knapsackトリアージの本質は「同じ時間をかけるなら配点が高い方を残す」という時間対効果の比較であり、
   * 分母に shortfallMinutes（間に合わなかった分）を使うと「間に合わなさが大きいもの」が
   * 機械的に切られやすくなってしまい、意味が変わる。
   */
  efficiency: number;
  shortfallMinutes: number;
}

/**
 * 前向きシミュレーション結果から「切る候補」を効率の低い順（昇順）に並べる。
 * ForwardSimulationResult 以外の新たな保存状態は持たない別の純粋関数。
 * shortfallMinutes > 0 の小項目のみが対象（間に合う見込みのものは切る必要が無い）。
 */
export function triageSubtopics(result: ForwardSimulationResult, chapters: Chapter[]): TriageCandidate[] {
  const chapterById = new Map(chapters.map((c) => [c.id, c]));

  return result.subtopics
    .filter((forecast) => forecast.shortfallMinutes > 0)
    .map((forecast) => {
      const chapter = chapterById.get(forecast.chapterId);
      const weight = chapter ? subtopicPointWeights(chapter).get(forecast.subtopicId) ?? 0 : 0;
      return {
        chapterId: forecast.chapterId,
        subtopicId: forecast.subtopicId,
        subjectId: forecast.subjectId,
        efficiency: forecast.totalMinutesNeeded > 0 ? weight / forecast.totalMinutesNeeded : 0,
        shortfallMinutes: forecast.shortfallMinutes,
      };
    })
    .sort((a, b) => a.efficiency - b.efficiency);
}

/** 「間に合わない見込み＋切る候補」を表示するトリガーの閾値（分）。1学習ブロック分程度の暫定値・調整可能 */
export const FORECAST_SHORTFALL_THRESHOLD_MINUTES = 45;

/**
 * ある教科の見通し（間に合わない見込み＋切る候補）セクションを表示すべきかどうかの判定。
 * 以下の2条件を両方満たすときのみ true：
 * 1. その教科の合計不足分（totalShortfallMinutes）が FORECAST_SHORTFALL_THRESHOLD_MINUTES を超えている
 *    （まとまった不足。1件だけ数分オーバーする程度は翌日の貪欲な再配分で吸収されるため無視する）
 * 2. その教科のいずれかの小項目にセッションが1件以上記録されている
 *    （登録直後に「何十個も登録した瞬間に間に合わない」という誤警報を防ぐ。フェーズ4の
 *    「セッション0件は悪いほうに倒さない」と同じ考え方）
 * テスト直前の抑制はしない（フェーズ4の PROBLEM_TIER_MIN_DAYS_LEFT とは逆。シミュレーションは
 * テストが近いほど信頼度が上がるため、テスト当日まで表示し続ける）。
 */
export function shouldSurfaceForecastForSubject(
  summary: SubjectForecastSummary,
  sessions: StudySession[],
  chapters: Chapter[],
): boolean {
  if (summary.totalShortfallMinutes <= FORECAST_SHORTFALL_THRESHOLD_MINUTES) return false;
  const chapterIds = new Set(chapters.filter((c) => c.subjectId === summary.subjectId).map((c) => c.id));
  return sessions.some((s) => !!s.subtopicId && chapterIds.has(s.chapterId));
}

// ---- 英単語暗記（確定設計 v3、docs/feature-memorization.md 参照） ----
// 単語の意味テキストは一切保存せず、単語帳の見出し番号／教科書レッスン内の通し番号という
// 「番号」だけで学習範囲を識別する。ただし単語1つずつではなく、固定20語ずつの「枠」
// （VocabChunk）を管理単位とする（300語以上を1語ずつ回答させるのは負担が大きすぎるため）。
// 既存の Chapter/StudySession/generateTodayPlan とは完全に独立したロジック系統。
// 枠の状態は連続値の理解度ではなく「復習継続中」か「完了（completed）」の二値のみで表す。

/**
 * Leitnerの箱1〜5に対応する復習間隔（日数）。
 * インデックス0が箱1、インデックス4が箱5に対応する（= VOCAB_BOX_INTERVAL_DAYS[box - 1]）。
 * 箱が上がるほど間隔が伸びる（復習を重ねた枠ほど頻度を下げる）。
 */
export const VOCAB_BOX_INTERVAL_DAYS = [1, 3, 7, 14, 30];

/** 単語帳の範囲を分割する1枠あたりの語数。 */
export const VOCAB_CHUNK_SIZE = 20;

/**
 * 単語帳の範囲登録で一度に生成してよい上限語数。スマホでの入力ミス（371→3710など）で
 * 大量の枠が生成され、保存失敗やフリーズに見える動作を防ぐためのガード
 * （ux-reviewer指摘、2026-07-03）。Onboarding/Settings 両方の登録フォームで共有する。
 */
export const MAX_VOCAB_RANGE_SIZE = 1000;

/** 単語帳の範囲登録フォームの入力値バリデーション対象（ドラフトの一部フィールドのみ参照する） */
export interface VocabRangeDraftInput {
  label: string;
  startNumber: number | null;
  endNumber: number | null;
}

/**
 * 単語帳の範囲登録フォームの入力値を検証する。Onboarding/Settings で共通のバリデーションを
 * 使うことで、片方だけラベル空欄チェックを忘れる、上限チェックが片方にしか無い、といった
 * 実装の食い違いを防ぐ（ux-reviewer指摘、2026-07-03）。問題なければ null を返す。
 */
export function validateVocabRangeDraft(input: VocabRangeDraftInput): string | null {
  if (input.label.trim() === "") {
    return "暗記範囲のラベルを入力してください。";
  }
  if (
    input.startNumber === null ||
    input.endNumber === null ||
    input.startNumber < 1 ||
    input.endNumber < input.startNumber
  ) {
    return "暗記範囲（開始番号・終了番号）を正しく入力してください。";
  }
  if (input.endNumber - input.startNumber + 1 > MAX_VOCAB_RANGE_SIZE) {
    return `暗記範囲は一度に${MAX_VOCAB_RANGE_SIZE}語までにしてください（入力ミスの可能性があります）。`;
  }
  return null;
}

/**
 * 範囲登録（VocabRange）から、startNumber〜endNumber を VOCAB_CHUNK_SIZE 語ずつに機械的に
 * 分割した未着手の VocabChunk を生成する。最後の枠が5語未満になる場合は、極端に短い枠を
 * 避けるため直前の枠と合算する（それ以外の端数（5〜19語）はそのまま独立した最後の枠にする）。
 * id は `${range.id}-${startNumber}-${endNumber}` という決定的な値にする
 * （logic.ts は純粋関数のみを置く方針のため、uid() のような非決定的なID生成は
 * store/component 側の責務とし、ここでは同じ入力から常に同じ出力になるようにする）。
 */
export function generateChunksForRange(range: VocabRange): VocabChunk[] {
  const chunks: VocabChunk[] = [];
  let start = range.startNumber;
  const end = range.endNumber;
  while (start <= end) {
    let chunkEnd = Math.min(start + VOCAB_CHUNK_SIZE - 1, end);
    const remainingAfterChunk = end - chunkEnd;
    if (remainingAfterChunk > 0 && remainingAfterChunk < 5) {
      chunkEnd = end;
    }
    chunks.push({
      id: `${range.id}-${start}-${chunkEnd}`,
      rangeId: range.id,
      startNumber: start,
      endNumber: chunkEnd,
      introduced: false,
      box: 0,
      nextReviewDate: null,
      completed: false,
    });
    start = chunkEnd + 1;
  }
  return chunks;
}

/**
 * ある箱（1〜5）の次回復習日を、today から VOCAB_BOX_INTERVAL_DAYS だけ先の日付として計算する。
 */
function nextReviewDateForBox(box: 1 | 2 | 3 | 4 | 5, today: Date): string {
  const intervalDays = VOCAB_BOX_INTERVAL_DAYS[box - 1];
  const base = startOfDay(today);
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + intervalDays);
  return toISODate(next);
}

/**
 * Leitner箱の状態遷移。生徒が「まだ完璧じゃない」と答えるたびに呼ばれる（確定設計 v3では
 * 正誤の概念を持ち込まないため、旧設計にあった不正解時の箱リセットは無い。まだ復習を
 * 続けているという申告そのものが、箱を1つ進めて次の復習間隔を伸ばす材料になる）。
 * - 未着手（introduced: false）の枠に初めて取り組んだ場合：箱1からスタートする。
 * - 既に着手済みの枠：箱を1つ上げる（最大5）。
 */
export function advanceVocabChunk(chunk: VocabChunk, today: Date): VocabChunk {
  const nextBox = (chunk.introduced ? Math.min((chunk.box > 0 ? chunk.box : 1) + 1, 5) : 1) as
    | 1
    | 2
    | 3
    | 4
    | 5;
  return { ...chunk, introduced: true, box: nextBox, nextReviewDate: nextReviewDateForBox(nextBox, today) };
}

/**
 * 生徒が「完璧になった」と明示的に報告した枠を完了扱いにする。box/nextReviewDate は
 * そのまま残す（ローテーションから外すのは出題対象を集める側で completed をフィルタする）。
 */
export function completeVocabChunk(chunk: VocabChunk): VocabChunk {
  return { ...chunk, completed: true };
}

/**
 * ある範囲の、今日の新規学習ペース（1日あたり何枠まで新規着手すべきか）を自動計算する。
 * 未着手の枠数 ÷ テストまでの残り日数（切り上げ）。
 * テスト日が既に過ぎている、または未着手の枠が0件の場合は 0 を返す。
 */
export function calculateDailyNewVocabPace(
  range: VocabRange,
  chunks: VocabChunk[],
  testDate: string,
  today: Date,
): number {
  if (isPastDate(testDate, today)) return 0;
  const notIntroducedCount = chunks.filter((chunk) => chunk.rangeId === range.id && !chunk.introduced).length;
  if (notIntroducedCount === 0) return 0;
  return Math.ceil(notIntroducedCount / daysLeft(testDate, today));
}

export interface TodaysVocabChunks {
  newChunks: VocabChunk[];
  reviewChunks: VocabChunk[];
  /**
   * 数日サボった後などで、復習期限（nextReviewDate）を過ぎたまま溜まっていた枠が
   * 今日まとめて出てきているかどうか。true のとき、呼び出し側は「間が空いたのでまとめて
   * 出ています」といった配慮のひと言を添えることが期待される（ux-reviewer指摘、2026-07-03。
   * 見通し機能フェーズ5で徹底した「頑張りが足りないからではない」という配慮を単語機能にも
   * 適用する）。毎日きちんと取り組んでいれば nextReviewDate=今日 の枠しか出ないため false のまま。
   */
  hasBacklog: boolean;
}

/**
 * 今日取り組むべき単語の枠を集める。
 * - newChunks: まだ未着手の枠のうち、その範囲の1日あたりペース分だけ、番号の若い順に選ぶ。
 * - reviewChunks: 着手済み・未完了で nextReviewDate が今日以前（due）の枠。
 * completed な枠は新規・復習どちらの対象にも絶対に含めない（生徒が「完璧になった」と
 * 報告した枠をローテーションから外すのが今回の設計の肝）。
 * 対応する教科のテスト日を過ぎている範囲は、新規・復習どちらの対象からも除外する。
 */
export function getTodaysVocabChunks(
  ranges: VocabRange[],
  chunks: VocabChunk[],
  subjects: Subject[],
  today: Date,
): TodaysVocabChunks {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const newChunks: VocabChunk[] = [];
  const reviewChunks: VocabChunk[] = [];

  for (const range of ranges) {
    const subject = subjectById.get(range.subjectId);
    if (!subject) continue;
    if (isPastDate(subject.testDate, today)) continue;

    const rangeChunks = chunks.filter((chunk) => chunk.rangeId === range.id);

    const pace = calculateDailyNewVocabPace(range, rangeChunks, subject.testDate, today);
    const notIntroduced = rangeChunks
      .filter((chunk) => !chunk.introduced)
      .sort((a, b) => a.startNumber - b.startNumber);
    newChunks.push(...notIntroduced.slice(0, pace));

    const due = rangeChunks.filter(
      (chunk) =>
        chunk.introduced &&
        !chunk.completed &&
        chunk.nextReviewDate !== null &&
        daysSince(chunk.nextReviewDate, today) >= 0,
    );
    reviewChunks.push(...due);
  }

  // 予定日ちょうど（daysSince === 0）は毎日普通に取り組んでいても起きる。
  // 予定日を1日以上過ぎている（daysSince > 0）枠があれば、間が空いて溜まった結果だと判断する。
  const hasBacklog = reviewChunks.some(
    (chunk) => chunk.nextReviewDate !== null && daysSince(chunk.nextReviewDate, today) > 0,
  );

  return { newChunks, reviewChunks, hasBacklog };
}

/** 単語1語あたりの回答目安時間（秒）の下限・上限。Home画面の所要時間表示に使う概算値 */
export const VOCAB_SECONDS_PER_ITEM_LOW = 10;
export const VOCAB_SECONDS_PER_ITEM_HIGH = 15;

/**
 * 今日取り組む単語の枠数から、概算の所要時間（分）を幅で見積もる。1枠 = VOCAB_CHUNK_SIZE 語
 * 相当として、章の演習と違って基礎/発展問題数のような入力が無いため、1語あたり固定の
 * 目安秒数のみで概算する（ux-reviewer指摘：他の章カードには所要時間表示があるのに
 * 単語カードだけ無い）。
 */
export function estimateVocabMinutes(chunkCount: number): { lowMinutes: number; highMinutes: number } {
  if (chunkCount <= 0) return { lowMinutes: 0, highMinutes: 0 };
  const wordCount = chunkCount * VOCAB_CHUNK_SIZE;
  const lowMinutes = Math.max(1, Math.round((wordCount * VOCAB_SECONDS_PER_ITEM_LOW) / 60));
  const highMinutes = Math.max(lowMinutes, Math.round((wordCount * VOCAB_SECONDS_PER_ITEM_HIGH) / 60));
  return { lowMinutes, highMinutes };
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
