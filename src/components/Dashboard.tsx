import { useMemo, useState } from "react";
import { useStore } from "../store";
import {
  daysLeft,
  decayedUnderstanding,
  subtopicUnderstandingTier,
  subtopicProblemTier,
  worstProgressTier,
  PROGRESS_TIER_LABELS,
  type ProgressTier,
} from "../logic";
import type { Chapter, StudySession, Subject } from "../types";

// 仕様書 §7.4 理解度ダッシュボード
// 教科ごとに章を一覧、理解度をバーで可視化（現在 vs 目標）、テストまでの残り日数を表示。
export function Dashboard({ onGoSettings }: { onGoSettings: () => void }) {
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

      {bySubject.map(({ subject, chapters }) => (
        <section key={subject.id} className="card">
          <div className="subject-head">
            <h3>{subject.name}</h3>
            <span className="days-left">
              テストまで {daysLeft(subject.testDate, today)} 日
            </span>
          </div>
          {chapters.length === 0 ? (
            <div className="empty">
              <p className="muted">章がありません。</p>
              <button className="secondary" onClick={onGoSettings}>
                設定で章を登録する
              </button>
            </div>
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
        </section>
      ))}
    </div>
  );
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
