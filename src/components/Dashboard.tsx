import { useMemo } from "react";
import { useStore } from "../store";
import { daysLeft } from "../logic";
import type { Chapter } from "../types";

// 仕様書 §7.4 理解度ダッシュボード
// 教科ごとに章を一覧、理解度をバーで可視化（現在 vs 目標）、テストまでの残り日数を表示。
export function Dashboard() {
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

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>理解度ダッシュボード</h2>
      </div>

      {bySubject.map(({ subject, chapters }) => (
        <section key={subject.id} className="card">
          <div className="subject-head">
            <h3>{subject.name}</h3>
            <span className="days-left">
              テストまで {daysLeft(subject.testDate, today)} 日
            </span>
          </div>
          {chapters.length === 0 ? (
            <p className="muted">章がありません。</p>
          ) : (
            <ul className="understanding-list">
              {chapters.map((c) => (
                <UnderstandingRow key={c.id} chapter={c} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function UnderstandingRow({ chapter }: { chapter: Chapter }) {
  const pct = Math.round(chapter.understanding * 100);
  const targetPct = Math.round(chapter.targetUnderstanding * 100);
  const reached = chapter.understanding >= chapter.targetUnderstanding;

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
    </li>
  );
}
