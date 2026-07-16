// 仕様書 §6 コアロジック（最小版）。すべて純粋関数として実装する。
import type {
  AvailabilitySettings,
  Chapter,
  ChapterSubtopic,
  ForecastDecisionState,
  StudyMode,
  StudySession,
  Subject,
  TimeSlot,
  VocabChunk,
  VocabRange,
} from "./types";
import { levelToUnderstanding } from "./data/subjectTemplates";

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
 * セッションの観測理解度を算出する（段階2）。
 * achievedLevel（達成段階の直接申告）があればそれを理解度へ直接マップした値を返し、
 * 無ければ従来どおり正答率・自己申告から computeObserved で合成した値を返す（レガシー経路）。
 */
export function sessionObservedUnderstanding(session: StudySession): number {
  if (session.achievedLevel !== undefined) return levelToUnderstanding(session.achievedLevel);
  return computeObserved(session.correctRate ?? 0, session.selfReport ?? 0);
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
 * priority = max(target − understanding, 0) × proximity
 * 配点による重み付けは廃止（中高生の定期テストでは生徒が配点を知り得ないため）。
 */
export function priority(chapter: Chapter, subject: Subject, today: Date): number {
  const currentUnderstanding = decayedUnderstanding(chapter, today);
  const gap = Math.max(chapter.targetUnderstanding - currentUnderstanding, 0);
  return gap * proximity(subject.testDate, today);
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
 * 「今日やること」を生成する（§6.3、フェーズ4.5で小項目単位、フェーズ6でシミュレーションに
 * 基づく除外＋スピルオーバーに対応）。
 * 1. 全章・小項目の優先度スコアを scoreChapterOrSubtopics で計算（デュアルパス）
 * 2. スコアの高い順に並べる
 * 3. availability が渡されていれば、simulateForward で「まとまった不足」が出ている章/小項目を
 *    候補集合（candidates）から除外する（間に合わない見込みの項目より、間に合う項目を優先する。
 *    優先度の計算式自体は変えない）。availability を省略した場合（シミュレーション不能）は除外を
 *    一切行わず、従来通りの貪欲割当のみ行う（既存呼び出し元・既存テストとの後方互換のため）。
 * 4. dailyMinutes を candidates から上位順に消化する（1周目）。
 * 5. 1周目で dailyMinutes を使い切れなかった場合（除外後の候補が少なすぎて余り時間が出た場合）、
 *    除外された項目（spillover、こちらも元のスコア降順）で残り時間を埋める2周目を行う。
 *    「除外」を完全なフィルタではなく「優先順位を下げる」という意味に変えることで、テスト直前など
 *    間に合わない章だらけの状況でも時間が無駄にならないようにする（ある教科の章が全部除外されても
 *    他教科の消費で埋まらなかった余りがあればスピルオーバーで拾われるため、教科が丸ごと計画から
 *    消える事故も減る）。割当ロジック（小項目ありなら estimateSubtopicRemainingMinutes のクランプ、
 *    小項目無しなら SESSION_MINUTES 固定）は1周目・2周目で完全に同じものを使う（allocate 参照）。
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
  availability?: AvailabilitySettings,
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
    // 既に目標到達（伸びしろ0）の章/小項目は今日やる必要がないので除外。
    // 暗記モード（studyMode: 'memorize'、後悔防止トリガーで「切り替える」を選んだ項目）は、
    // 意識的に深い理解を諦めた項目なので、理解度を無理に上げにいく貪欲割当の対象からも外す
    // （Phase 2、docs/feature-study-policy.md。完全な計画再設計はしない最小限の変更）。
    .filter((x) => x.score > 0 && effectiveStudyMode(x.chapter, x.subtopic) !== "memorize")
    .sort((a, b) => b.score - a.score);

  const candidates = excludeUnlikelyToFinish(scored, chapters, subjects, availability, today, sessions);
  // 除外された項目（スピルオーバー用に元のスコア降順のまま保持しておく）
  const candidateKeys = new Set(candidates.map((c) => `${c.chapter.id}:${c.subtopic?.id ?? ""}`));
  const spillover = scored.filter((item) => !candidateKeys.has(`${item.chapter.id}:${item.subtopic?.id ?? ""}`));

  const plan: PlanItem[] = [];
  let remaining = dailyMinutes;
  const ratesCache = new Map<string, LearnedProblemRates>();

  function allocate(item: { chapter: Chapter; subtopic: ChapterSubtopic | null; subject: Subject; score: number }): void {
    const { chapter, subtopic, subject, score } = item;
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
      reasons = buildSubtopicReasons(chapter, subtopic, subject, today);
    } else {
      allocatedMinutes = Math.min(SESSION_MINUTES, remaining);
      reasons = buildReasons(chapter, subject, today);
    }

    plan.push({ chapter, subtopic, subject, allocatedMinutes, priority: score, reasons });
    remaining -= allocatedMinutes;
  }

  for (const item of candidates) {
    if (remaining <= 0) break;
    allocate(item);
  }

  // スピルオーバー（2周目）：間に合う見込みの項目だけでは dailyMinutes を使い切れなかった場合、
  // 除外された項目（間に合わない見込み）でも他に使う道のない余り時間を埋める
  for (const item of spillover) {
    if (remaining <= 0) break;
    allocate(item);
  }

  return plan;
}

/**
 * フェーズ6：前向きシミュレーション（simulateForward）で「まとまった不足」が出ている章/小項目を
 * 候補集合から除外する。availability が渡されない場合（シミュレーション不能。既存呼び出し元との
 * 後方互換のため任意引数）は何もせず候補をそのまま返す。
 * 除外した結果、候補が1件も残らなくなる場合は、除外前の最優先1件（scored は既にスコア降順）を
 * 必ず1件戻す（テスト直前に「間に合わない章」が一斉脱落して0件プランになる事故の防止策）。
 */
function excludeUnlikelyToFinish<T extends { chapter: Chapter; subtopic: ChapterSubtopic | null; score: number }>(
  scored: T[],
  chapters: Chapter[],
  subjects: Subject[],
  availability: AvailabilitySettings | undefined,
  today: Date,
  sessions: StudySession[],
): T[] {
  if (!availability || scored.length === 0) return scored;

  const forecast = simulateForward(chapters, subjects, availability, today, sessions);
  const excludedKeys = new Set(
    forecast.subtopics
      .filter((f) => f.shortfallMinutes > FORECAST_SHORTFALL_THRESHOLD_MINUTES)
      .map((f) => `${f.chapterId}:${f.subtopicId ?? ""}`),
  );
  if (excludedKeys.size === 0) return scored;

  const filtered = scored.filter((item) => !excludedKeys.has(`${item.chapter.id}:${item.subtopic?.id ?? ""}`));
  return filtered.length > 0 ? filtered : [scored[0]];
}

/** 「今日の計画」の固定スナップショットが指す1件（章IDと、任意の小項目ID） */
export interface PlanItemKey {
  chapterId: string;
  subtopicId: string | null;
}

/**
 * 固定された itemKeys（章ID＋小項目ID）の集合から PlanItem[] を組み立てる。
 * generateTodayPlan と違い、対象集合そのものは引数の itemKeys で固定済みという前提に立ち、
 * ここでは dailyMinutes の消化・並べ替えは行わない（呼び出し側が保持する順序をそのまま使う）。
 * allocatedMinutes・reasons・priority は、その時点の最新の章/小項目データから
 * generateTodayPlan と同じ計算式で再計算する（Settingsでの章編集に追随させるため）。
 * 該当する章/小項目が既に存在しない場合（Settingsで削除された等）はその項目を結果から除外する。
 */
export function buildPlanFromItemKeys(
  chapters: Chapter[],
  subjects: Subject[],
  itemKeys: PlanItemKey[],
  today: Date,
  sessions: StudySession[] = [],
): PlanItem[] {
  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const ratesCache = new Map<string, LearnedProblemRates>();

  const plan: PlanItem[] = [];
  for (const key of itemKeys) {
    const chapter = chapterById.get(key.chapterId);
    if (!chapter) continue;
    const subject = subjectById.get(chapter.subjectId);
    if (!subject) continue;

    if (key.subtopicId) {
      const subtopic = (chapter.subtopics ?? []).find((s) => s.id === key.subtopicId);
      if (!subtopic) continue;

      if (!ratesCache.has(subject.id)) {
        ratesCache.set(subject.id, learnedProblemRates(sessions, chapters, subject.id));
      }
      const rates = ratesCache.get(subject.id)!;
      const estimate = estimateSubtopicRemainingMinutes(subtopic, today, rates).totalMinutes;
      const allocatedMinutes = Math.max(MIN_SUBTOPIC_SESSION_MINUTES, Math.min(SESSION_MINUTES, Math.ceil(estimate)));
      const score = subtopicPriority(chapter, subtopic, subject, today);
      const reasons = buildSubtopicReasons(chapter, subtopic, subject, today);
      plan.push({ chapter, subtopic, subject, allocatedMinutes, priority: score, reasons });
    } else {
      const score = priority(chapter, subject, today);
      const reasons = buildReasons(chapter, subject, today);
      plan.push({ chapter, subtopic: null, subject, allocatedMinutes: SESSION_MINUTES, priority: score, reasons });
    }
  }

  return plan;
}

/** 「理解度が低め／テストが近い」程度の簡単な根拠（§7.2） */
function buildReasons(
  chapter: Chapter,
  subject: Subject,
  today: Date,
): string[] {
  const reasons: string[] = [];

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

/** 小項目版の「理解度が低め／テストが近い／先生のヒントあり」根拠ラベル */
function buildSubtopicReasons(
  chapter: Chapter,
  subtopic: ChapterSubtopic,
  subject: Subject,
  today: Date,
): string[] {
  const reasons: string[] = [];

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
  // achievedLevel（達成段階の直接申告）があれば理解度を直接セットする（平滑化しない）。
  // 達成段階は宣言的な状態でノイズを含まないため、平滑化はむしろ実態とのズレを生む。
  // 無ければ従来どおり computeObserved + updateUnderstanding の平滑化にフォールバックする
  // （レガシーセッション・旧テストとの互換のため）。
  const understanding =
    session.achievedLevel !== undefined
      ? levelToUnderstanding(session.achievedLevel)
      : updateUnderstanding(chapter.understanding, computeObserved(session.correctRate ?? 0, session.selfReport ?? 0));
  return {
    ...chapter,
    understanding,
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

  const target = subtopics[index];
  const understanding =
    session.achievedLevel !== undefined
      ? levelToUnderstanding(session.achievedLevel)
      : updateUnderstanding(target.understanding ?? 0, computeObserved(session.correctRate ?? 0, session.selfReport ?? 0));
  const updatedSubtopic: ChapterSubtopic = {
    ...target,
    understanding,
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
 * 小項目版の優先度スコア。章版 priority と同じ形（伸びしろ × 近さ）に、
 * 先生のヒント（teacherHinted）によるブースト（配点とは無関係の実在シグナル）を掛ける。
 */
/** 先生からのテストヒントがあった小項目の優先度に掛けるボーナス倍率（暫定値） */
export const TEACHER_HINT_PRIORITY_BOOST = 1.5;

export function subtopicPriority(
  chapter: Chapter,
  subtopic: ChapterSubtopic,
  subject: Subject,
  today: Date,
): number {
  const target = subtopic.targetUnderstanding ?? chapter.targetUnderstanding;
  const currentUnderstanding = decayedSubtopicUnderstanding(subtopic, today);
  const gap = Math.max(target - currentUnderstanding, 0);
  const hintMultiplier = subtopic.teacherHinted ? TEACHER_HINT_PRIORITY_BOOST : 1;
  return gap * proximity(subject.testDate, today) * hintMultiplier;
}

/**
 * 章/小項目の「有効な」studyMode（後悔防止トリガー機能、Phase 2）。
 * 小項目がある場合は subtopic.studyMode が優先される（chapter.studyMode は小項目が無い章のみ意味を持つ）。
 * 未設定は 'understand' 扱い。
 */
export function effectiveStudyMode(chapter: Chapter, subtopic: ChapterSubtopic | null): StudyMode {
  if (subtopic) return subtopic.studyMode ?? "understand";
  return chapter.studyMode ?? "understand";
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

// ---- 小項目の所要時間見積もり（基礎問題のみ） ------------------------
// 発展問題は 2026-07-09 に廃止（数えにくく達成段階ラダーの段階5と二重管理のため）。
// 見積もり・ペース判定は基礎問題数と理解度の伸びしろのみで行う。
// StudySession.advancedProblemsCompleted / ChapterSubtopic.advancedProblems の型は
// 後方互換のため残置してあるが、読み書きはしない。

/** 理解度がこの値未満のときだけ「概念学習コスト」を上乗せする（毎回の再計算で重複計上しないよう閾値化） */
export const CONCEPT_LEARNING_COST_MINUTES = 20;
/** 基礎問題1問あたりの目安時間（分）。実測データがまだ十分に貯まっていないときのデフォルト値 */
export const MINUTES_PER_BASIC_PROBLEM = 13;

/** 理解度がこの値未満なら、まだ概念そのものを学べていないとみなす閾値 */
const CONCEPT_UNDERSTANDING_THRESHOLD = 0.2;

export interface SubtopicTimeEstimate {
  conceptMinutes: number;
  basicMinutes: number;
  totalMinutes: number;
}

/** これ未満の「純粋な」実測セッション数しか無ければ、まだ学習値を信頼せずデフォルト値を使う（暫定値） */
export const MIN_SESSIONS_FOR_LEARNED_RATE = 3;

export interface LearnedProblemRates {
  basicMinutesPerProblem: number;
}

/**
 * 教科ごとに、基礎問題1問あたりの実際にかかった時間を過去のセッション記録から学習する。
 * 基礎問題を記録したセッションを対象に、`session.minutes / 完了数` の単純平均を取る。
 * 対象セッションが MIN_SESSIONS_FOR_LEARNED_RATE 件未満なら、まだ学習値を信頼せず
 * MINUTES_PER_BASIC_PROBLEM のデフォルト値を返す。
 * （発展問題は 2026-07-09 に廃止。基礎のみを学習対象とする）
 */
export function learnedProblemRates(
  sessions: StudySession[],
  chapters: Chapter[],
  subjectId: string,
): LearnedProblemRates {
  const chapterIds = new Set(chapters.filter((c) => c.subjectId === subjectId).map((c) => c.id));

  const pure = sessions.filter(
    (s) => s.subtopicId && chapterIds.has(s.chapterId) && (s.basicProblemsCompleted ?? 0) > 0,
  );
  if (pure.length < MIN_SESSIONS_FOR_LEARNED_RATE) {
    return { basicMinutesPerProblem: MINUTES_PER_BASIC_PROBLEM };
  }
  const rates = pure.map((s) => s.minutes / (s.basicProblemsCompleted ?? 1));
  return { basicMinutesPerProblem: rates.reduce((a, b) => a + b, 0) / rates.length };
}

// ---- 「見通し」機能フェーズ6：教科ごとの学習ペース倍率 ----

/** 学習ペース倍率の算出に必要な最小限のサンプル数（未満なら補正なしの1.0にフォールバック、暫定値） */
export const MIN_SESSIONS_FOR_PACE_MULTIPLIER = 5;

/** 学習ペース倍率の下限・上限（cto提案）。少数の絶好調/絶不調セッションで極端な補正がかかるのを防ぐ */
export const PACE_MULTIPLIER_MIN = 0.5;
export const PACE_MULTIPLIER_MAX = 2.0;

/**
 * 「標準的なペース」とみなす、1分あたりの理解度の伸びの基準値（暫定値）。
 * SESSION_MINUTES（45分）のセッション1回で理解度0.5相当伸びるくらいを標準とみなし、実測ペース
 * （subjectPaceMultiplier が算出する中央値）をこの基準値と比較して倍率を決める。
 */
export const BASELINE_UNDERSTANDING_GAIN_PER_MINUTE = 0.5 / SESSION_MINUTES;

function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * 教科ごとの「学習ペース倍率」。実測の理解度の伸び方が基準より速い教科は残り所要時間の見積もりを
 * 短く、遅い教科は長くするための補正係数。章/小項目単位では算出しない
 * （learnedProblemRates と同じ理由で、データが疎になりすぎて信頼できないため必ず教科単位で集計する）。
 *
 * 各セッションについて「(そのセッションの観測理解度 − 直前の理解度) ÷ 分」を1分あたりの伸びの
 * サンプルとみなす。「直前の理解度」は、同じ章/小項目（subtopicId があればそれ、無ければ
 * chapterId）のセッションを日付順に並べ、sessionObservedUnderstanding をそのまま直接セットして
 * その場で再現する（段階2：achievedLevel は宣言的な値のため平滑化しない。レガシー経路の
 * computeObserved 値も同じ直接セット式で積み上げる）。
 * （グループの最初のセッションだけは「直前」が無いためサンプルを作らず、積み上げの起点にする）。
 * サンプルは単純平均ではなく中央値で集計する（1回の絶好調/絶不調セッションに引きずられないため）。
 * サンプル数が MIN_SESSIONS_FOR_PACE_MULTIPLIER 未満なら、まだ信頼できないとして補正なし（1.0）を返す。
 * 最終的な倍率は PACE_MULTIPLIER_MIN 〜 PACE_MULTIPLIER_MAX にクランプする。
 * UI表示（「あなたはこの教科が速い/遅い」の可視化）は今回のスコープ外（作らない）。
 */
export function subjectPaceMultiplier(
  sessions: StudySession[],
  chapters: Chapter[],
  subjectId: string,
): number {
  const chapterIds = new Set(chapters.filter((c) => c.subjectId === subjectId).map((c) => c.id));
  const relevant = sessions.filter((s) => chapterIds.has(s.chapterId));

  const groups = new Map<string, StudySession[]>();
  for (const session of relevant) {
    const key = session.subtopicId ? `${session.chapterId}:${session.subtopicId}` : session.chapterId;
    const list = groups.get(key);
    if (list) list.push(session);
    else groups.set(key, [session]);
  }

  const samples: number[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let running: number | null = null;
    for (const session of sorted) {
      const observed = sessionObservedUnderstanding(session);
      if (running !== null && session.minutes > 0) {
        samples.push((observed - running) / session.minutes);
      }
      // 達成段階の直接セット化（段階2）に合わせ、履歴再現も平滑化ではなく直接セットで積み上げる。
      running = observed;
    }
  }

  if (samples.length < MIN_SESSIONS_FOR_PACE_MULTIPLIER) return 1.0;

  const rate = median(samples);
  return clampRange(rate / BASELINE_UNDERSTANDING_GAIN_PER_MINUTE, PACE_MULTIPLIER_MIN, PACE_MULTIPLIER_MAX);
}

/**
 * 小項目の残り所要時間を見積もる。
 * remainingRatio（1 − 減衰後理解度）を基礎/発展それぞれの問題数に掛けて按分する。
 * difficultyLevel はここでは使わない（問題数ベースの見積もりと混在させると二重計上になるため、
 * 今は候補提示用の付随情報にとどめる）。
 * rates を省略した場合はデフォルト値（MINUTES_PER_BASIC_PROBLEM / MINUTES_PER_ADVANCED_PROBLEM）を使う。
 * paceMultiplier（フェーズ6、教科ごとの学習ペース倍率）を省略した場合は 1（補正なし）。
 * 速い教科（倍率>1）ほど短く、遅い教科（倍率<1）ほど長く見積もる。
 */
export function estimateSubtopicRemainingMinutes(
  subtopic: ChapterSubtopic,
  today: Date,
  rates: LearnedProblemRates = {
    basicMinutesPerProblem: MINUTES_PER_BASIC_PROBLEM,
  },
  paceMultiplier: number = 1,
): SubtopicTimeEstimate {
  const currentUnderstanding = decayedSubtopicUnderstanding(subtopic, today);
  const remainingRatio = 1 - currentUnderstanding;
  const conceptMinutes = currentUnderstanding < CONCEPT_UNDERSTANDING_THRESHOLD ? CONCEPT_LEARNING_COST_MINUTES : 0;
  const basicMinutes = (subtopic.basicProblems ?? 0) * rates.basicMinutesPerProblem * remainingRatio;
  return {
    conceptMinutes: conceptMinutes / paceMultiplier,
    basicMinutes: basicMinutes / paceMultiplier,
    totalMinutes: (conceptMinutes + basicMinutes) / paceMultiplier,
  };
}

/** 小項目を持たない章の、演習1問あたりの「基礎/発展の中間値」的な目安分数（cto提案の暫定値） */
export const MINUTES_PER_PROBLEM_CHAPTER_ESTIMATE = 18;

/** metadata.exerciseCount が無い章の粗い見積もりで使う、伸びしろどれだけにつき SESSION_MINUTES 1ブロック分とみなすか（暫定値） */
export const CHAPTER_ESTIMATE_GAP_INCREMENT = 0.1;

/**
 * 小項目を持たない章の残り所要時間を見積もる（フェーズ6、estimateSubtopicRemainingMinutes の章版）。
 * chapter.metadata.exerciseCount（任意項目。Onboardingで未入力のことが多い）があれば
 * 「演習数 × 1問あたり目安分数 × 伸びしろ」で見積もり、無ければ伸びしろに比例した粗い見積もり
 * （伸びしろ CHAPTER_ESTIMATE_GAP_INCREMENT につき SESSION_MINUTES 1ブロック相当）にフォールバックする。
 * 小項目版と違い基礎/発展の内訳を持たないため、厳密さは求めない設計（ドキュメント準拠）。
 * paceMultiplier（教科ごとの学習ペース倍率）で最後に割ってから返す。
 */
export function estimateChapterRemainingMinutes(
  chapter: Chapter,
  today: Date,
  paceMultiplier: number = 1,
): number {
  const currentUnderstanding = decayedUnderstanding(chapter, today);
  const gap = Math.max(chapter.targetUnderstanding - currentUnderstanding, 0);
  const exerciseCount = chapter.metadata?.exerciseCount;
  const rawMinutes =
    exerciseCount !== undefined
      ? exerciseCount * MINUTES_PER_PROBLEM_CHAPTER_ESTIMATE * gap
      : (gap / CHAPTER_ESTIMATE_GAP_INCREMENT) * SESSION_MINUTES;
  return rawMinutes / paceMultiplier;
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

/** その小項目のセッションで、これまでに解いた基礎問題数の累計（発展は 2026-07-09 に廃止） */
export function cumulativeSubtopicProblemsCompleted(
  sessions: StudySession[],
  subtopicId: string,
): number {
  return sessionsForSubtopic(sessions, subtopicId).reduce(
    (acc, s) => acc + (s.basicProblemsCompleted ?? 0),
    0,
  );
}

/** 直近 days 日以内（today を含む）に解いた基礎問題数の合計（発展は 2026-07-09 に廃止） */
export function recentSubtopicProblemsCompleted(
  sessions: StudySession[],
  subtopicId: string,
  today: Date,
  days: number = RECENT_ACTIVITY_WINDOW_DAYS,
): number {
  return sessionsForSubtopic(sessions, subtopicId)
    .filter((s) => {
      const elapsed = daysSince(s.date, today);
      return elapsed >= 0 && elapsed <= days;
    })
    .reduce((acc, s) => acc + (s.basicProblemsCompleted ?? 0), 0);
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
}

/**
 * 演習消化ペースのティア（基礎問題のみ。発展は 2026-07-09 に廃止）。
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
    return { basic: null };
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
    basic: tierFor(subtopic.basicProblems, cumulative, recent),
  };
}

/** 複数ティア（null混じり）の中で最も悪いものを返す。全て null なら null */
export function worstProgressTier(tiers: (ProgressTier | null)[]): ProgressTier | null {
  const severity: Record<ProgressTier, number> = { on_track: 0, slightly_behind: 1, at_risk: 2 };
  const present = tiers.filter((t): t is ProgressTier => t !== null);
  if (present.length === 0) return null;
  return present.reduce((worst, t) => (severity[t] > severity[worst] ? t : worst));
}

// ---- 「見通し」機能フェーズ5〜6：前向きシミュレーション・トリアージ ----
// フェーズ5では小項目を持つ章のみが対象だったが、フェーズ6で小項目を持たない「普通の章」も
// 同じ枠組みに載せた。scoreChapterOrSubtopics と同じデュアルパスで、小項目が無い章は
// subtopic: null の1件として扱い、estimateChapterRemainingMinutes で残り所要分を見積もる
// （小項目がある章は従来通り estimateSubtopicRemainingMinutes）。
// 内部状態は各項目（章 or 小項目）の「残り所要分（分）」というスカラーのみ。today 時点で一度だけ
// 見積もりを評価してスナップショットし、以降は日ごとに割り当てた分を引くだけ。未来日で
// decayedUnderstanding/decayedSubtopicUnderstanding を再計算・再見積もりは絶対にしない
// （勉強しない日ほど decay で残り所要分が増える、という負のフィードバックループを避けるため）。
// これは generateTodayPlan が未来日の decay を一切見ないことと一貫している。

export interface SubtopicForecast {
  chapterId: string;
  /** null なら章レベル（小項目を持たない章、フェーズ6で追加） */
  subtopicId: string | null;
  subjectId: string;
  /** day 0（today）時点で見積もった、この章/小項目を終えるのに必要な総分数 */
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
  atRiskSubtopicIds: (string | null)[];
}

export interface ForwardSimulationResult {
  subtopics: SubtopicForecast[];
  subjects: SubjectForecastSummary[];
}

/** シミュレーション内部だけで使う可変ワーキングオブジェクト（外部には公開しない） */
interface ForecastTrackedItem {
  chapter: Chapter;
  /** null なら章レベル（小項目を持たない章、フェーズ6で追加） */
  subtopic: ChapterSubtopic | null;
  subject: Subject;
  totalMinutesNeeded: number;
  remainingMinutes: number;
  completionDate: string | null;
}

/**
 * 今日から最も遅いテスト日まで、日ごとに貪欲割当をシミュレートし、
 * 各章/小項目がいつ終わるか／テスト日に間に合うかを予測する。
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
  const paceCache = new Map<string, number>();

  const items: ForecastTrackedItem[] = [];
  for (const chapter of chapters) {
    const subject = subjectById.get(chapter.subjectId);
    if (!subject) continue;

    if (!ratesCache.has(subject.id)) {
      ratesCache.set(subject.id, learnedProblemRates(sessions, chapters, subject.id));
    }
    const rates = ratesCache.get(subject.id)!;

    if (!paceCache.has(subject.id)) {
      paceCache.set(subject.id, subjectPaceMultiplier(sessions, chapters, subject.id));
    }
    const paceMultiplier = paceCache.get(subject.id)!;

    const subtopics = chapter.subtopics ?? [];
    if (subtopics.length === 0) {
      // 暗記モードの章は意識的に深い理解を諦めた項目なので、シミュレーション自体の対象から外す
      // （shortfall会計・切る候補（triageSubtopics）から除外するため。Phase 2）。
      if (effectiveStudyMode(chapter, null) === "memorize") continue;
      const totalMinutesNeeded = estimateChapterRemainingMinutes(chapter, today, paceMultiplier);
      items.push({
        chapter,
        subtopic: null,
        subject,
        totalMinutesNeeded,
        remainingMinutes: totalMinutesNeeded,
        completionDate: totalMinutesNeeded <= 0 ? toISODate(today) : null,
      });
      continue;
    }

    for (const subtopic of subtopics) {
      if (effectiveStudyMode(chapter, subtopic) === "memorize") continue;
      const totalMinutesNeeded = estimateSubtopicRemainingMinutes(subtopic, today, rates, paceMultiplier).totalMinutes;
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
          .map((item) => ({
            item,
            score: item.subtopic
              ? subtopicPriority(item.chapter, item.subtopic, item.subject, dayDate)
              : priority(item.chapter, item.subject, dayDate),
          }))
          .sort((a, b) => b.score - a.score);

        for (const { item } of sorted) {
          if (remainingBudget <= 0) break;
          // 既存の [MIN_SUBTOPIC_SESSION_MINUTES, SESSION_MINUTES] クランプに加え、
          // この項目自身の残り分にもクランプ（完了を超えて過剰割当しない）
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
      subtopicId: item.subtopic?.id ?? null,
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
  /** null なら章レベルの候補（小項目を持たない章、フェーズ6で追加） */
  subtopicId: string | null;
  subjectId: string;
  /**
   * day 0（today）時点で見積もった、この章/小項目を終えるのに必要な総分数。
   * 値が大きいほど「残り所要時間が長い」＝切る候補として優先度が高い
   * （時間内に終わらせることが目的である以上、残り時間がかかりすぎるものから優先的に切る、という考え方。
   * 配点による重み付けは廃止済みのため、時間対効果ではなく所要時間そのものを基準にする）。
   */
  totalMinutesNeeded: number;
  shortfallMinutes: number;
}

/**
 * 前向きシミュレーション結果から「切る候補」を残り所要時間の長い順（降順）に並べる。
 * ForwardSimulationResult 以外の新たな保存状態は持たない別の純粋関数。
 * shortfallMinutes > 0 の章/小項目のみが対象（間に合う見込みのものは切る必要が無い）。
 */
export function triageSubtopics(result: ForwardSimulationResult): TriageCandidate[] {
  return result.subtopics
    .filter((forecast) => forecast.shortfallMinutes > 0)
    .map((forecast) => ({
      chapterId: forecast.chapterId,
      subtopicId: forecast.subtopicId,
      subjectId: forecast.subjectId,
      totalMinutesNeeded: forecast.totalMinutesNeeded,
      shortfallMinutes: forecast.shortfallMinutes,
    }))
    .sort((a, b) => b.totalMinutesNeeded - a.totalMinutesNeeded);
}

/** 「間に合わない見込み＋切る候補」を表示するトリガーの閾値（分）。1学習ブロック分程度の暫定値・調整可能 */
export const FORECAST_SHORTFALL_THRESHOLD_MINUTES = 45;

/**
 * ある教科の見通し（間に合わない見込み＋切る候補）セクションを表示すべきかどうかの判定。
 * 以下の2条件を両方満たすときのみ true：
 * 1. その教科の合計不足分（totalShortfallMinutes）が FORECAST_SHORTFALL_THRESHOLD_MINUTES を超えている
 *    （まとまった不足。1件だけ数分オーバーする程度は翌日の貪欲な再配分で吸収されるため無視する）
 * 2. その教科のいずれかの章（小項目を持たない章を含む、フェーズ6）にセッションが1件以上記録されている
 *    （登録直後に「何十個も登録した瞬間に間に合わない」という誤警報を防ぐ。フェーズ4の
 *    「セッション0件は悪いほうに倒さない」と同じ考え方。フェーズ5時点では小項目セッションのみを
 *    見ていたが、フェーズ6で小項目を持たない章もシミュレーション対象になったため、章全体の
 *    セッション（subtopicId 無し）も同様に「取り組み始めている」証拠として数える）
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
  return sessions.some((s) => chapterIds.has(s.chapterId));
}

// ---- 後悔防止トリガー（Phase 2、docs/feature-study-policy.md 参照） ----
// 「テストが終わった後の後悔（この単元にもっと時間をかけていれば…）」を防ぐため、
// simulateForward の結果を毎日1回だけ評価し、ある章/小項目が3日連続で「間に合わない候補」
// （shortfallMinutes > 0）に入り続けたら、Home で「続ける／切り替える」を問いかける。
// 対象は章を持つ教科（数学・理科・英語）のみ。社会は現状 vocab 専用で章が無いため、
// chapters配列に社会の章がそもそも存在せず、自動的に対象外になる（Phase 3の章化まで対象外）。

/** 何日連続で shortfall があれば問いかけを出すか（暫定値） */
export const SHORTFALL_STREAK_THRESHOLD_DAYS = 3;

/** 「続ける」を選んだときに再確認を抑制する日数（暫定値） */
export const FORECAST_DECISION_SNOOZE_DAYS = 3;

/** 章/小項目1件を指す合成キー（generateTodayPlan 内で使っているのと同じ形に揃える） */
export function forecastDecisionKey(chapterId: string, subtopicId: string | null): string {
  return `${chapterId}:${subtopicId ?? ""}`;
}

/**
 * simulateForward の結果から、各章/小項目の「連続shortfall日数」を1日1回だけ更新する。
 * ensureTodayPlan（store.tsx）と同じ「同日なら二重カウントしない」パターンを踏襲し、
 * lastEvaluatedDate が既に今日と一致する項目はそのまま前回の状態を保持する
 * （呼び出し側が1日に何度呼んでもストリークが余計に進まないようにするための安全策）。
 * shortfallMinutes > 0 の日はストリーク+1、0（間に合う見込みに戻った）日は0にリセットする。
 * studyMode === 'memorize' の項目（意識的に諦めた項目）は forecast.subtopics 自体に
 * 含まれない（simulateForward 側で除外済み）ため自然に評価対象から外れるが、念のため
 * ここでも同じ判定を明示しておく（simulateForward の除外実装が変わっても壊れないように）。
 */
export function updateForecastDecisions(
  forecast: ForwardSimulationResult,
  chapters: Chapter[],
  previous: Record<string, ForecastDecisionState>,
  today: Date,
): Record<string, ForecastDecisionState> {
  const todayISO = toISODate(today);
  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  const next: Record<string, ForecastDecisionState> = { ...previous };

  for (const item of forecast.subtopics) {
    const chapter = chapterById.get(item.chapterId);
    if (!chapter) continue;
    const subtopic = item.subtopicId
      ? (chapter.subtopics ?? []).find((s) => s.id === item.subtopicId) ?? null
      : null;
    if (effectiveStudyMode(chapter, subtopic) === "memorize") continue;

    const key = forecastDecisionKey(item.chapterId, item.subtopicId);
    const existing = next[key];
    if (existing && existing.lastEvaluatedDate === todayISO) continue;

    const shortfallStreak = item.shortfallMinutes > 0 ? (existing?.shortfallStreak ?? 0) + 1 : 0;
    next[key] = {
      shortfallStreak,
      lastEvaluatedDate: todayISO,
      snoozeUntilDate: existing?.snoozeUntilDate,
    };
  }

  return next;
}

/**
 * 「続ける／切り替える」を問いかけるべきかどうかの判定。
 * ストリークが閾値未満、暗記モードに切り替え済み、または「続ける」を選んだ直後で
 * まだ snoozeUntilDate（未来日）を過ぎていない場合は問いかけない。
 */
export function shouldPromptForecastDecision(
  state: ForecastDecisionState | undefined,
  studyMode: StudyMode,
  today: Date,
): boolean {
  if (!state) return false;
  if (studyMode === "memorize") return false;
  if (state.shortfallStreak < SHORTFALL_STREAK_THRESHOLD_DAYS) return false;
  if (state.snoozeUntilDate && daysSince(state.snoozeUntilDate, today) < 0) return false;
  return true;
}

/**
 * 「このまま続ける」を選んだ結果の新しい状態。ストリークを0に戻し、
 * today から FORECAST_DECISION_SNOOZE_DAYS 日後まで再確認を抑制する。
 */
export function snoozeForecastDecision(today: Date): ForecastDecisionState {
  const snoozeDate = new Date(today);
  snoozeDate.setDate(snoozeDate.getDate() + FORECAST_DECISION_SNOOZE_DAYS);
  return {
    shortfallStreak: 0,
    lastEvaluatedDate: toISODate(today),
    snoozeUntilDate: toISODate(snoozeDate),
  };
}

/**
 * 「解き方/訳文を覚えるモードに切り替える」を選んだ結果の章の更新。
 * 小項目が指定されていればその小項目の studyMode のみを切り替え（章本体は変更しない）、
 * 指定が無ければ章本体の studyMode を切り替える。該当する小項目が見つからない場合は
 * 章をそのまま返す（applySessionToSubtopic と同じ安全策）。
 */
export function switchToMemorizeMode(chapter: Chapter, subtopicId: string | null): Chapter {
  if (!subtopicId) return { ...chapter, studyMode: "memorize" };
  const subtopics = chapter.subtopics ?? [];
  const index = subtopics.findIndex((s) => s.id === subtopicId);
  if (index === -1) return chapter;
  const updatedSubtopics = [...subtopics];
  updatedSubtopics[index] = { ...updatedSubtopics[index], studyMode: "memorize" };
  return { ...chapter, subtopics: updatedSubtopics };
}

/**
 * switchToMemorizeMode の逆操作。「切り替える」に取り消し手段が無いのは CLAUDE.md の
 * 「取り消しのつくUI」方針に反する（ux-reviewer指摘）ため追加。studyMode を 'understand' に
 * 戻すだけで、暗記モード中に何を勉強したかの記録（セッション等）自体は変更しない。
 */
export function restoreUnderstandMode(chapter: Chapter, subtopicId: string | null): Chapter {
  if (!subtopicId) return { ...chapter, studyMode: "understand" };
  const subtopics = chapter.subtopics ?? [];
  const index = subtopics.findIndex((s) => s.id === subtopicId);
  if (index === -1) return chapter;
  const updatedSubtopics = [...subtopics];
  updatedSubtopics[index] = { ...updatedSubtopics[index], studyMode: "understand" };
  return { ...chapter, subtopics: updatedSubtopics };
}

/** Home に表示すべき「続ける/切り替える」問いかけ1件（対象の章/小項目・教科を指す） */
export interface ForecastDecisionPrompt {
  chapterId: string;
  subtopicId: string | null;
  subjectId: string;
}

/**
 * 今、問いかけを出すべき章/小項目を集める。chapters を走査するだけで自然に
 * 「章を持つ教科（数学・理科・英語）のみ」に絞られる（社会は章を持たないため）。
 */
export function collectForecastDecisionPrompts(
  chapters: Chapter[],
  forecastDecisions: Record<string, ForecastDecisionState>,
  today: Date,
): ForecastDecisionPrompt[] {
  const prompts: ForecastDecisionPrompt[] = [];
  for (const chapter of chapters) {
    const subtopics = chapter.subtopics ?? [];
    if (subtopics.length === 0) {
      const key = forecastDecisionKey(chapter.id, null);
      if (shouldPromptForecastDecision(forecastDecisions[key], effectiveStudyMode(chapter, null), today)) {
        prompts.push({ chapterId: chapter.id, subtopicId: null, subjectId: chapter.subjectId });
      }
      continue;
    }
    for (const subtopic of subtopics) {
      const key = forecastDecisionKey(chapter.id, subtopic.id);
      if (shouldPromptForecastDecision(forecastDecisions[key], effectiveStudyMode(chapter, subtopic), today)) {
        prompts.push({ chapterId: chapter.id, subtopicId: subtopic.id, subjectId: chapter.subjectId });
      }
    }
  }
  return prompts;
}

/** Settings の「暗記モードに切り替えた項目」一覧1件（対象の章/小項目・教科を指す） */
export interface MemorizeModeItem {
  chapterId: string;
  subtopicId: string | null;
  subjectId: string;
}

/**
 * studyMode === 'memorize' の章/小項目をすべて集める（Settings の恒久的な「理解モードに戻す」
 * 導線用。ux-reviewer指摘：取り消し手段が Home のインライン事後表示だけだと、そのセッションを
 * 離れた後に戻す手段が無くなる）。
 */
export function collectMemorizeModeItems(chapters: Chapter[]): MemorizeModeItem[] {
  const items: MemorizeModeItem[] = [];
  for (const chapter of chapters) {
    const subtopics = chapter.subtopics ?? [];
    if (subtopics.length === 0) {
      if (effectiveStudyMode(chapter, null) === "memorize") {
        items.push({ chapterId: chapter.id, subtopicId: null, subjectId: chapter.subjectId });
      }
      continue;
    }
    for (const subtopic of subtopics) {
      if (effectiveStudyMode(chapter, subtopic) === "memorize") {
        items.push({ chapterId: chapter.id, subtopicId: subtopic.id, subjectId: chapter.subjectId });
      }
    }
  }
  return items;
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

// ---- オンボーディング・ウィザードのステップ別バリデーション ------------
// 本格ウィザード化（docs/feature-onboarding-wizard.md）で「最後にまとめて検証」から
// 「ステップごとに検証」へ変えるにあたり、旧単一フォームで教科ごとに重複していたロジックを
// 共通の純粋関数にまとめた。

/**
 * ステップ「テスト日を登録」で1教科ぶんの入力を検証する。未入力→過去日の順にチェックする。
 */
export function validateTestDate(subjectLabel: string, date: string, today: Date): string | null {
  if (!date) {
    return `${subjectLabel}のテスト日を入力してください。`;
  }
  if (isPastDate(date, today)) {
    return `${subjectLabel}のテスト日は今日以降の日付にしてください。`;
  }
  return null;
}

/** 曜日ごと/日付ごとの時間帯グループのうち、終了が開始より前になっている不正なスロットが1つでもあるか */
export function hasInvalidTimeSlotInSchedule(slotGroups: TimeSlot[][]): boolean {
  return slotGroups.some((slots) => slots.some((slot) => !isValidTimeSlot(slot)));
}

/** 曜日ごと/日付ごとの時間帯グループのうち、有効なスロットが1つでもあるか */
export function hasAnyValidTimeSlotInSchedule(slotGroups: TimeSlot[][]): boolean {
  return slotGroups.some((slots) => slots.some((slot) => isValidTimeSlot(slot)));
}

/**
 * ステップ「教科ごとの内容入力」の必須条件：章と暗記範囲はどちらも「学習する範囲」の登録手段なので、
 * どちらか1つでもあれば足りる（単語帳のみで使いたい生徒に、意味のない章を登録させないため。
 * ux-reviewer指摘、docs/phase0-history.md）。
 */
export function validateSubjectHasContent(
  namedChapterCount: number,
  attemptedVocabRangeCount: number,
): string | null {
  if (namedChapterCount === 0 && attemptedVocabRangeCount === 0) {
    return "章または暗記範囲を1つ以上登録してください。";
  }
  return null;
}

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

// ---- 学習履歴（Dashboard の「学習履歴」セクション表示用） --------------

/** 学習履歴の1日ぶんのセッション明細 */
export interface DailyStudySessionEntry {
  subjectName: string;
  chapterName: string;
  subtopicName: string | null;
  minutes: number;
}

/** 学習履歴の1日ぶんの集計 */
export interface DailyStudyHistory {
  /** "YYYY-MM-DD" */
  date: string;
  totalMinutes: number;
  sessions: DailyStudySessionEntry[];
}

/**
 * 直近 days 日間（今日を含む、古い日→新しい日の順）の日別学習時間履歴を作る。
 * セッションが1件も無い日も合計0分・空配列として含める（歯抜けにしない。7日固定のローリング
 * ウィンドウで棒グラフ表示するため、日付が抜けると棒の間隔がズレて見えるのを避ける）。
 * StudySession 自体は subjectId を持たないため、chapterId から Chapter → subjectId → Subject
 * と辿って教科名を解決する。
 */
export function buildStudyHistory(
  sessions: StudySession[],
  chapters: Chapter[],
  subjects: Subject[],
  today: Date,
  days: number = 7,
): DailyStudyHistory[] {
  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const result: DailyStudyHistory[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    const dateStr = toISODate(day);

    const entries: DailyStudySessionEntry[] = sessions
      .filter((s) => s.date === dateStr)
      .map((s) => {
        const chapter = chapterById.get(s.chapterId);
        const subject = chapter ? subjectById.get(chapter.subjectId) : undefined;
        const subtopicName = s.subtopicId
          ? chapter?.subtopics?.find((st) => st.id === s.subtopicId)?.name ?? null
          : null;
        return {
          subjectName: subject?.name ?? "",
          chapterName: chapter?.name ?? "",
          subtopicName,
          minutes: s.minutes,
        };
      });

    result.push({
      date: dateStr,
      totalMinutes: entries.reduce((sum, e) => sum + e.minutes, 0),
      sessions: entries,
    });
  }
  return result;
}

/**
 * 連続記録ストリーク：「その日にセッション記録が1件でもある日」が連続している日数。
 * buildStudyHistory と同じゆるい基準（記録があれば継続。計画完遂などの厳しい条件にはしない）。
 * 今日はまだ記録が無くても、昨日までの連続記録は「今日中に記録すれば継続」という生存猶予を
 * 与える（毎朝ストリークが0に見える不自然さを防ぐ。記録し忘れれば日付が変わって自然に途切れる）。
 * 上限なし（buildStudyHistory の7日固定窓とは別の専用ロジック）。
 */
export function computeStreak(sessions: StudySession[], today: Date): number {
  const studiedDates = new Set(sessions.map((s) => s.date));
  const todayISO = toISODate(today);

  let cursor: Date;
  if (studiedDates.has(todayISO)) {
    cursor = startOfDay(today);
  } else {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (!studiedDates.has(toISODate(yesterday))) return 0;
    cursor = startOfDay(yesterday);
  }

  let streak = 0;
  while (studiedDates.has(toISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---- 小さなユーティリティ ---------------------------------------------

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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
