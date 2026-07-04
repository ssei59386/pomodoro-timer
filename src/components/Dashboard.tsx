import { useMemo, useState } from "react";
import { useStore } from "../store";
import {
  daysLeft,
  decayedUnderstanding,
  subtopicUnderstandingTier,
  subtopicProblemTier,
  worstProgressTier,
  PROGRESS_TIER_LABELS,
  simulateForward,
  triageSubtopics,
  shouldSurfaceForecastForSubject,
  type ProgressTier,
  type ForwardSimulationResult,
  type TriageCandidate,
} from "../logic";
import type { Chapter, StudySession, Subject } from "../types";

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
}: {
  onGoSettings: () => void;
  onGoHome: () => void;
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

  const forecast = useMemo(
    () => simulateForward(data.chapters, data.subjects, data.availability, today, data.sessions),
    [data.chapters, data.subjects, data.availability, today, data.sessions],
  );

  const triageCandidates = useMemo(
    () => triageSubtopics(forecast, data.chapters),
    [forecast, data.chapters],
  );

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

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>理解度ダッシュボード</h2>
      </div>

      {hasAnySubtopics && (
        <p className="muted small tier-badge-explainer">
          「理解度」「演習」バッジは、目標までの到達度と直近1週間の実績をもとに判定しています。
        </p>
      )}

      {subjectsToSurface.size > 0 && (
        <p className="muted small forecast-scope-note">
          ※ 小項目未設定の章はこの見通しの対象外です。
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
 * 「今のペースだと間に合わない見込み」＋「切る候補」セクション（フェーズ5）。
 * shouldSurfaceForecastForSubject が true の教科だけ、呼び出し側から描画される。
 * 心理面の配慮（設計ドキュメント必須4点）：
 * 1. 断定を避け「今のペースだと」の条件つき表現に統一
 * 2. 予測の直後に必ず「今日のプランを見る」導線を置く
 * 3. 「あくまで目安」トーンを明示
 * 4. 切る候補は「時間配分の効率上」というフレーミングで、効率の数値を見せて算数であることを示す
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

  const nameOf = (chapterId: string, subtopicId: string) => {
    const chapter = chapterById.get(chapterId);
    const subtopicName = chapter?.subtopics?.find((s) => s.id === subtopicId)?.name ?? "";
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
            <li key={f.subtopicId} className="forecast-row">
              <span className="forecast-item-name">
                {chapterName} ・ {subtopicName}
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
            時間配分の効率上、優先度を下げる候補です（頑張りが足りないという意味ではありません）。
          </p>
          <ul className="triage-list">
            {triageForSubject.map((t) => {
              const { chapterName, subtopicName } = nameOf(t.chapterId, t.subtopicId);
              return (
                <li key={t.subtopicId} className="triage-row">
                  <span className="triage-item-name">
                    {chapterName} ・ {subtopicName}
                  </span>
                  <span className="triage-efficiency muted small">
                    配点効率 {t.efficiency.toFixed(2)} 点/分（他の項目より時間対効果が低め）
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

function UnderstandingRow({
  chapter,
  subject,
  sessions,
  today,
}: {
  chapter: Chapter;
  subject: Subject;
  sessions: StudySession[];
  today: Date;
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
    ? worstProgressTier(
        problemTiersBySubtopic.flatMap(({ tiers }) => [tiers.basic, tiers.advanced]),
      )
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
        配点 {chapter.pointWeight} 点
        {chapter.lastStudiedDate ? ` ・ 最終学習 ${chapter.lastStudiedDate}` : " ・ 未学習"}
      </div>

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
                    <div className="tier-badge-row">
                      <TierBadge label="理解度" tier={stTier} />
                      {stProblemTiers.basic && <TierBadge label="基礎" tier={stProblemTiers.basic} />}
                      {stProblemTiers.advanced && (
                        <TierBadge label="発展" tier={stProblemTiers.advanced} />
                      )}
                    </div>
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
