import { useMemo, useState } from "react";
import { useStore } from "../store";
import {
  daysLeft,
  decayedUnderstanding,
  effectiveStudyMode,
  forecastDecisionKey,
  subtopicUnderstandingTier,
  subtopicProblemTier,
  worstProgressTier,
  PROGRESS_TIER_LABELS,
  simulateForward,
  triageSubtopics,
  shouldSurfaceForecastForSubject,
  buildStudyHistory,
  type ProgressTier,
  type ForwardSimulationResult,
  type SubtopicForecast,
  type TriageCandidate,
  type DailyStudyHistory,
} from "../logic";
import type { Chapter, StudySession, Subject } from "../types";
import { TodayStrategyAiChat } from "./TodayStrategyAiChat";

// 社会・国語は暗記専用教科で章を持たない設計（docs/feature-memorization.md 確定設計v4）。
// この2教科では「章がありません→章を登録」という空状態を出さない（押しても章を追加する
// 手段が無い行き止まりになるため）。この教科の進捗は下の「単語帳の進捗」セクションで見る前提。
const CHAPTERLESS_SUBJECTS = new Set(["社会", "国語"]);

// 仕様書 §7.4 理解度ダッシュボード
// 教科ごとに章を一覧、理解度をバーで可視化（現在 vs 目標）、テストまでの残り日数を表示。
// フェーズ5：Phase4のペースバッジの下に「見通し（前向きシミュレーション）＋切る候補（トリアージ）」を
// 積む形で拡張。新しい画面・タブ・Homeバナーは作らない（設計ドキュメント通り）。
export function Dashboard({
  onGoSettings,
  onGoHome,
  onShowStudyPolicy,
}: {
  onGoSettings: () => void;
  onGoHome: () => void;
  onShowStudyPolicy: () => void;
}) {
  const { data } = useStore();
  const today = useMemo(() => new Date(), []);

  const bySubject = useMemo(
    () =>
      data.subjects.map((subject) => ({
        subject,
        chapters: data.chapters.filter((c) => c.subjectId === subject.id),
      })),
    [data.subjects, data.chapters],
  );

  const hasAnySubtopics = data.chapters.some((c) => (c.subtopics?.length ?? 0) > 0);

  const studyHistory = useMemo(
    () => buildStudyHistory(data.sessions, data.chapters, data.subjects, today),
    [data.sessions, data.chapters, data.subjects, today],
  );

  const forecast = useMemo(
    () => simulateForward(data.chapters, data.subjects, data.availability, today, data.sessions),
    [data.chapters, data.subjects, data.availability, today, data.sessions],
  );

  const triageCandidates = useMemo(() => triageSubtopics(forecast), [forecast]);

  // 「切る候補」セクションでしか使っていなかった見通しデータ（残り所要分・見込み完了日）を、
  // 通常の理解度カードでも引けるように章/小項目キーでルックアップできる形にする
  // （新しい計算ロジックは追加しない。既存の simulateForward の結果を再利用するだけ）。
  const forecastByKey = useMemo(() => {
    const map = new Map<string, SubtopicForecast>();
    for (const f of forecast.subtopics) {
      map.set(forecastDecisionKey(f.chapterId, f.subtopicId), f);
    }
    return map;
  }, [forecast]);

  // 「まとまった不足がある」かつ「その教科に取り組み始めている」の両方を満たす教科だけ見通しを出す
  const subjectsToSurface = useMemo(
    () =>
      new Set(
        forecast.subjects
          .filter((summary) => shouldSurfaceForecastForSubject(summary, data.sessions, data.chapters))
          .map((summary) => summary.subjectId),
      ),
    [forecast.subjects, data.sessions, data.chapters],
  );

  // 「今日の作戦」AI相談用の集計。新しい計算ロジックは追加せず、既存の simulateForward の
  // 結果（forecast）を件数集計するだけ（CEO/CTO確認済み：詳細な理解度数値・学習履歴は渡さない）。
  // shortfallCount/topPriorityLabel は subjectsToSurface（＝画面の「見通し」セクション自体が
  // 表示対象とする教科）でフィルタする。フィルタしないと、まだ着手していない教科の不足まで
  // 集計に混ざり、画面のどこにも根拠が出ていない数字をAIパネルだけが提示してしまう
  // （ux-reviewer指摘、断定を避ける方針に反する）。onTrackCountは常時表示のForecastRemainingNote
  // と矛盾しないため全件のままでよい。
  const shortfallCount = useMemo(
    () =>
      forecast.subtopics.filter(
        (f) => subjectsToSurface.has(f.subjectId) && f.shortfallMinutes > 0,
      ).length,
    [forecast.subtopics, subjectsToSurface],
  );
  const onTrackCount = useMemo(
    () => forecast.subtopics.filter((f) => f.onTrack).length,
    [forecast.subtopics],
  );
  const topPriorityLabel = useMemo(() => {
    let best: { subjectId: string; totalShortfallMinutes: number } | null = null;
    for (const summary of forecast.subjects) {
      if (!subjectsToSurface.has(summary.subjectId)) continue;
      if (summary.totalShortfallMinutes <= 0) continue;
      if (!best || summary.totalShortfallMinutes > best.totalShortfallMinutes) {
        best = summary;
      }
    }
    if (!best) return null;
    return data.subjects.find((s) => s.id === best.subjectId)?.name ?? null;
  }, [forecast.subjects, subjectsToSurface, data.subjects]);

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>理解度ダッシュボード</h2>
      </div>

      <button type="button" className="secondary study-policy-entry-btn" onClick={onShowStudyPolicy}>
        📖 勉強方針を見る
      </button>

      {forecast.subtopics.length > 0 && (
        <TodayStrategyAiChat
          shortfallCount={shortfallCount}
          onTrackCount={onTrackCount}
          topPriorityLabel={topPriorityLabel}
        />
      )}

      <StudyHistorySection history={studyHistory} />

      {hasAnySubtopics && (
        <p className="muted small tier-badge-explainer">
          「理解度」「演習」バッジは、目標までの到達度と直近1週間の実績をもとに判定しています。
        </p>
      )}

      {bySubject.map(({ subject, chapters }) => (
        <section key={subject.id} className="card">
          <div className="subject-head">
            <h3>{subject.name}</h3>
            <span className="days-left">
              テストまで {daysLeft(subject.testDate, today)} 日
            </span>
          </div>
          {chapters.length === 0 ? (
            CHAPTERLESS_SUBJECTS.has(subject.name) ? (
              <p className="muted small">
                この教科は下の「単語帳の進捗」で確認できます。
              </p>
            ) : (
              <div className="empty">
                <p className="muted">章がありません。</p>
                <button className="secondary" onClick={onGoSettings}>
                  設定で章を登録する
                </button>
              </div>
            )
          ) : (
            <ul className="understanding-list">
              {chapters.map((c) => (
                <UnderstandingRow
                  key={c.id}
                  chapter={c}
                  subject={subject}
                  sessions={data.sessions}
                  today={today}
                  forecastByKey={forecastByKey}
                />
              ))}
            </ul>
          )}

          {subjectsToSurface.has(subject.id) && (
            <ForecastSection
              subject={subject}
              chapters={chapters}
              forecast={forecast}
              triageCandidates={triageCandidates}
              onGoHome={onGoHome}
            />
          )}
        </section>
      ))}

      {data.vocabRanges.length > 0 && (
        <section className="card">
          <h3>単語帳の進捗</h3>
          <ul className="vocab-progress-list">
            {data.vocabRanges.map((range) => {
              const chunks = data.vocabChunks.filter((c) => c.rangeId === range.id);
              const completedCount = chunks.filter((c) => c.completed).length;
              return (
                <li key={range.id} className="vocab-progress-row">
                  <span className="chapter-name">{range.label}</span>
                  <span className="muted small">
                    {`${range.startNumber}〜${range.endNumber}番のうち、完了した枠 ${completedCount}／${chunks.length}枠`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * 「勉強したものを視覚的にわかりやすくしたい」という要望から追加した学習履歴セクション。
 * 直近7日間（今日を含むローリングウィンドウ）の日別合計学習分数を棒グラフで見せる。
 * 定期テスト前の短期モチベーション用途のため、全期間ではなく直近7日に絞る（過去の空白期間が
 * 目立つと逆効果になるため）。単語帳（VocabChunk）は時間を記録していないためスコープ外。
 */
function StudyHistorySection({ history }: { history: DailyStudyHistory[] }) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const totalMinutes = history.reduce((sum, day) => sum + day.totalMinutes, 0);
  const hasAnyRecord = totalMinutes > 0;
  const maxMinutes = Math.max(1, ...history.map((day) => day.totalMinutes));
  const todayStr = history.length > 0 ? history[history.length - 1].date : "";

  return (
    <section className="card study-history-section">
      <h3>学習履歴</h3>
      {!hasAnyRecord ? (
        <p className="muted small">
          まだ記録がありません。セッションを記録すると、ここに学習の様子が表示されます。
        </p>
      ) : (
        <>
          <p className="study-history-total">直近7日間の合計：{formatMinutesLabel(totalMinutes)}</p>
          <div className="study-history-chart" role="group" aria-label="直近7日間の学習時間">
            {history.map((day) => {
              const isToday = day.date === todayStr;
              const isExpanded = expandedDate === day.date;
              const barHeightPct = Math.max(2, Math.round((day.totalMinutes / maxMinutes) * 100));
              return (
                <button
                  key={day.date}
                  type="button"
                  className={
                    isToday
                      ? "study-history-bar-btn study-history-bar-btn-today"
                      : "study-history-bar-btn"
                  }
                  onClick={() => setExpandedDate((prev) => (prev === day.date ? null : day.date))}
                  aria-expanded={isExpanded}
                  aria-label={`${formatDayLabel(day.date)}${isToday ? "（今日）" : ""} ${day.totalMinutes}分`}
                >
                  <span className="study-history-bar-minutes muted small">
                    {day.totalMinutes > 0 ? day.totalMinutes : ""}
                  </span>
                  <span className="study-history-bar-track">
                    <span
                      className={isToday ? "study-history-bar-fill today" : "study-history-bar-fill"}
                      style={{ height: `${barHeightPct}%` }}
                    />
                  </span>
                  <span className="study-history-bar-label muted small">{formatDayLabel(day.date)}</span>
                </button>
              );
            })}
          </div>

          {expandedDate && (
            <StudyHistoryDetail
              day={history.find((d) => d.date === expandedDate) ?? null}
            />
          )}
        </>
      )}
    </section>
  );
}

/** 展開時の内訳表示。合計0分の日を選んだ場合はその旨だけ出す */
function StudyHistoryDetail({ day }: { day: DailyStudyHistory | null }) {
  if (!day) return null;
  return (
    <ul className="study-history-detail-list">
      {day.sessions.length === 0 ? (
        <li className="muted small">この日の記録はありません。</li>
      ) : (
        day.sessions.map((entry, i) => (
          <li key={i} className="study-history-detail-row">
            <span className="chapter-name">
              {entry.subjectName}
              {entry.chapterName ? ` ・ ${entry.chapterName}` : ""}
              {entry.subtopicName ? ` ・ ${entry.subtopicName}` : ""}
            </span>
            <span className="muted small">{formatMinutesLabel(entry.minutes)}</span>
          </li>
        ))
      )}
    </ul>
  );
}

/** "YYYY-MM-DD" を「M/D」表記に整形する（棒グラフの下のラベル用） */
function formatDayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/**
 * 「今のペースだと間に合わない見込み」＋「切る候補」セクション（フェーズ5）。
 * shouldSurfaceForecastForSubject が true の教科だけ、呼び出し側から描画される。
 * 心理面の配慮（設計ドキュメント必須4点）：
 * 1. 断定を避け「今のペースだと」の条件つき表現に統一
 * 2. 予測の直後に必ず「今日のプランを見る」導線を置く
 * 3. 「あくまで目安」トーンを明示
 * 4. 切る候補は「時間がかかる項目は他を優先するため」というフレーミングで、頑張り不足ではないことを示す
 */
function ForecastSection({
  subject,
  chapters,
  forecast,
  triageCandidates,
  onGoHome,
}: {
  subject: Subject;
  chapters: Chapter[];
  forecast: ForwardSimulationResult;
  triageCandidates: TriageCandidate[];
  onGoHome: () => void;
}) {
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);

  // subtopicId が null の場合（小項目を持たない章、フェーズ6で追加）は章名だけを返す
  // （「→ 小項目名」の行を出さない null パス）。
  const nameOf = (chapterId: string, subtopicId: string | null) => {
    const chapter = chapterById.get(chapterId);
    const subtopicName = subtopicId ? chapter?.subtopics?.find((s) => s.id === subtopicId)?.name ?? "" : null;
    return { chapterName: chapter?.name ?? "", subtopicName };
  };

  // 深刻さ順（不足が大きいもの＝優先度が高いものを先に見せる）。UnderstandingRow の
  // sortedSubtopics（悪い順に並べる流儀）に揃える。
  const atRisk = forecast.subtopics
    .filter((f) => f.subjectId === subject.id && !f.onTrack)
    .sort((a, b) => b.shortfallMinutes - a.shortfallMinutes);
  // triageSubtopics 側で既に効率の低い（＝切る候補として優先度が高い）順にソート済み
  const triageForSubject = triageCandidates.filter((c) => c.subjectId === subject.id);

  if (atRisk.length === 0) return null;

  return (
    <div className="forecast-section">
      <h4 className="forecast-heading">🧭 今のペースでの見通し</h4>
      <p className="forecast-approx-note">
        あくまで目安です。演習1問あたりの所要時間の見積もりは、記録がまだ少ないうちは実測値ではなく仮の値を使っているため、誤差が出ることがあります。
      </p>

      <ul className="forecast-list">
        {atRisk.map((f) => {
          const { chapterName, subtopicName } = nameOf(f.chapterId, f.subtopicId);
          return (
            <li key={`${f.chapterId}-${f.subtopicId ?? "chapter"}`} className="forecast-row">
              <span className="forecast-item-name">
                {chapterName}
                {subtopicName ? ` ・ ${subtopicName}` : ""}
              </span>
              <span className="forecast-shortfall muted small">
                今のペースだと、テストまでに あと約{formatMinutesLabel(f.shortfallMinutes)} 足りない見込みです
              </span>
            </li>
          );
        })}
      </ul>

      <button type="button" className="secondary forecast-go-home-btn" onClick={onGoHome}>
        → 今日のプランを見る
      </button>

      {triageForSubject.length > 0 && (
        <div className="triage-section">
          <p className="triage-note">
            時間がかかる項目は他を優先するため、優先度を下げる候補です（頑張りが足りないという意味ではありません）。
          </p>
          <ul className="triage-list">
            {triageForSubject.map((t) => {
              const { chapterName, subtopicName } = nameOf(t.chapterId, t.subtopicId);
              return (
                <li key={`${t.chapterId}-${t.subtopicId ?? "chapter"}`} className="triage-row">
                  <span className="triage-item-name">
                    {chapterName}
                    {subtopicName ? ` ・ ${subtopicName}` : ""}
                  </span>
                  <span className="triage-efficiency muted small">
                    残り約{formatMinutesLabel(t.totalMinutesNeeded)}かかる見込みです（他の項目より時間がかかるため、優先度を下げる候補です）
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 分数を「N時間M分」表記に整形する（60分未満はそのまま「N分」）。大きい値ほど直感的に読めるようにする */
function formatMinutesLabel(minutes: number): string {
  const rounded = Math.max(0, Math.ceil(minutes));
  if (rounded < 60) return `${rounded}分`;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return remainder > 0 ? `${hours}時間${remainder}分` : `${hours}時間`;
}

/**
 * "YYYY-MM-DD" を「M月D日」表記に整形する（見通しの完了予定日表示用。年は出さない）。
 * CalendarOverrides.tsx の formatDateLabel は年込みのため流用せず別物として持つ。
 */
function formatShortDateLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

/**
 * 「あとどれくらいで終わるか」の具体的な目安（フェーズ6.5相当）。既存の見通し
 * （simulateForward）が既に持っているデータを表示するだけで、新しい計算は行わない。
 * - 既に目標達成（totalMinutesNeeded<=0）→ 何も出さない（reached表示で十分）
 * - 間に合わない見込み（projectedCompletionDate===null）→ 何も出さない
 *   （tier-badge と教科単位の見通しバナーで既に伝わっており、二重にネガティブ情報を出さない）
 * - 順調（間に合う見込み）→ 「見込み」を必ず使い、断定しないトーンで残り時間・完了予定日を出す
 */
function ForecastRemainingNote({ forecast }: { forecast: SubtopicForecast | undefined }) {
  if (!forecast) return null;
  if (forecast.totalMinutesNeeded <= 0) return null;
  if (!forecast.projectedCompletionDate) return null;
  return (
    <p className="muted small forecast-remaining-note">
      残り約{formatMinutesLabel(forecast.totalMinutesNeeded)}・
      {formatShortDateLabel(forecast.projectedCompletionDate)}ごろ終わる見込み
    </p>
  );
}

function UnderstandingRow({
  chapter,
  subject,
  sessions,
  today,
  forecastByKey,
}: {
  chapter: Chapter;
  subject: Subject;
  sessions: StudySession[];
  today: Date;
  forecastByKey: Map<string, SubtopicForecast>;
}) {
  const pct = Math.round(decayedUnderstanding(chapter, today) * 100);
  const targetPct = Math.round(chapter.targetUnderstanding * 100);
  const reached = decayedUnderstanding(chapter, today) >= chapter.targetUnderstanding;
  const [expanded, setExpanded] = useState(false);

  const subtopics = chapter.subtopics ?? [];
  const hasSubtopics = subtopics.length > 0;

  const understandingTier = hasSubtopics
    ? worstProgressTier(
        subtopics.map((st) => subtopicUnderstandingTier(chapter, st, sessions, today)),
      )
    : null;

  const problemTiersBySubtopic = hasSubtopics
    ? subtopics.map((st) => ({
        subtopic: st,
        tiers: subtopicProblemTier(st, sessions, subject.testDate, today),
      }))
    : [];

  const problemTier = hasSubtopics
    ? worstProgressTier(problemTiersBySubtopic.map(({ tiers }) => tiers.basic))
    : null;

  // 展開リストは状態が悪いものを先に見せる（安定ソート：同じ深刻度同士は元の順序を保つ）
  const TIER_SEVERITY: Record<ProgressTier, number> = { at_risk: 2, slightly_behind: 1, on_track: 0 };
  const sortedSubtopics = hasSubtopics
    ? [...subtopics].sort((a, b) => {
        const worstA = worstProgressTier([
          subtopicUnderstandingTier(chapter, a, sessions, today),
          ...Object.values(subtopicProblemTier(a, sessions, subject.testDate, today)),
        ]);
        const worstB = worstProgressTier([
          subtopicUnderstandingTier(chapter, b, sessions, today),
          ...Object.values(subtopicProblemTier(b, sessions, subject.testDate, today)),
        ]);
        const severityA = worstA ? TIER_SEVERITY[worstA] : -1;
        const severityB = worstB ? TIER_SEVERITY[worstB] : -1;
        return severityB - severityA;
      })
    : subtopics;

  return (
    <li className="understanding-row">
      <div className="understanding-row-head">
        <span className="chapter-name">{chapter.name}</span>
        {!hasSubtopics && effectiveStudyMode(chapter, null) === "memorize" && (
          <span className="memorize-mode-badge">🧠 暗記モード</span>
        )}
        <span className={reached ? "pct reached" : "pct"}>
          {pct}% / 目標 {targetPct}%
        </span>
      </div>
      <div className="bar">
        {/* 目標ライン */}
        <div className="bar-target" style={{ left: `${targetPct}%` }} />
        {/* 現在の理解度 */}
        <div
          className={reached ? "bar-fill reached" : "bar-fill"}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="chapter-meta muted">
        {chapter.lastStudiedDate ? `最終学習 ${chapter.lastStudiedDate}` : "未学習"}
      </div>
      {!hasSubtopics && (
        <ForecastRemainingNote forecast={forecastByKey.get(forecastDecisionKey(chapter.id, null))} />
      )}

      {hasSubtopics && (
        <>
          <div className="tier-badge-row">
            {understandingTier && <TierBadge label="理解度" tier={understandingTier} />}
            {problemTier && <TierBadge label="演習" tier={problemTier} />}
          </div>

          <button
            type="button"
            className="secondary subtopic-toggle-btn"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "閉じる" : "小項目の内訳を見る"}
          </button>

          {expanded && (
            <ul className="subtopic-progress-list">
              {sortedSubtopics.map((st) => {
                const stTier = subtopicUnderstandingTier(chapter, st, sessions, today);
                const stProblemTiers = subtopicProblemTier(st, sessions, subject.testDate, today);
                return (
                  <li key={st.id} className="subtopic-progress-row">
                    <span className="chapter-name">{st.name}</span>
                    {effectiveStudyMode(chapter, st) === "memorize" && (
                      <span className="memorize-mode-badge">🧠 暗記モード</span>
                    )}
                    <div className="tier-badge-row">
                      <TierBadge label="理解度" tier={stTier} />
                      {stProblemTiers.basic && <TierBadge label="基礎" tier={stProblemTiers.basic} />}
                    </div>
                    <ForecastRemainingNote forecast={forecastByKey.get(forecastDecisionKey(chapter.id, st.id))} />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </li>
  );
}

const TIER_CLASS: Record<ProgressTier, string> = {
  on_track: "tier-on-track",
  slightly_behind: "tier-slightly-behind",
  at_risk: "tier-at-risk",
};

function TierBadge({ label, tier }: { label: string; tier: ProgressTier }) {
  return (
    <span className={`tier-badge ${TIER_CLASS[tier]}`}>
      {label}：{PROGRESS_TIER_LABELS[tier]}
    </span>
  );
}
