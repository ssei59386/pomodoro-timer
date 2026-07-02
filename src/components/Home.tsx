import { useMemo } from "react";
import { useStore } from "../store";
import { generateTodayPlan, daysLeft, availableMinutesForDate } from "../logic";

// 仕様書 §7.2 ホーム（今日やること）
export function Home({
  onRecord,
  onGoSettings,
}: {
  onRecord: (chapterId?: string) => void;
  onGoSettings: () => void;
}) {
  const { data } = useStore();
  const today = useMemo(() => new Date(), []);

  const todayMinutes = useMemo(
    () => availableMinutesForDate(data.availability, today),
    [data.availability, today],
  );

  const plan = useMemo(
    () => generateTodayPlan(data.chapters, data.subjects, todayMinutes, today),
    [data.chapters, data.subjects, todayMinutes, today],
  );

  const totalMinutes = plan.reduce((sum, p) => sum + p.allocatedMinutes, 0);

  const buildDetailLine = (chapter: (typeof plan)[number]["chapter"]) => {
    const parts: string[] = [];
    if (chapter.metadata?.learningScope) {
      parts.push(`範囲: ${chapter.metadata.learningScope}`);
    }
    if (chapter.metadata?.exerciseCount) {
      parts.push(`演習問題 ${chapter.metadata.exerciseCount}問`);
    }
    if (chapter.subtopics && chapter.subtopics.length > 0) {
      parts.push(`小項目: ${chapter.subtopics.map((s) => s.name).join("、")}`);
    }
    return parts.length > 0 ? parts.join(" ・ ") : null;
  };

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>今日やること</h2>
        <p className="muted">
          配点・理解度・テストまでの近さから、優先度の高い章を割り当てています。
        </p>
      </div>

      {plan.length === 0 ? (
        <div className="empty">
          {data.chapters.length === 0 ? (
            <>
              <p>まだ章が登録されていません。</p>
              <button className="secondary" onClick={onGoSettings}>
                設定で章を登録する
              </button>
            </>
          ) : todayMinutes <= 0 ? (
            <>
              <p>今日は勉強できる時間が設定されていません。</p>
              <button className="secondary" onClick={onGoSettings}>
                設定で予定を確認する
              </button>
            </>
          ) : (
            <p>🎉 今日はすべての章が目標理解度に届いています。</p>
          )}
        </div>
      ) : (
        <>
          <div className="summary-pill">
            合計 {totalMinutes} 分 / {todayMinutes} 分・{plan.length} 章
          </div>
          <ul className="plan-list">
            {plan.map((item) => {
              const detailLine = buildDetailLine(item.chapter);
              return (
                <li key={item.chapter.id} className="plan-card">
                  <div className="plan-card-top">
                    <div>
                      <span className="subject-tag">{item.subject.name}</span>
                      <h3>{item.chapter.name}</h3>
                      {detailLine && <p className="muted small">{detailLine}</p>}
                    </div>
                    <div className="plan-minutes">{item.allocatedMinutes}分</div>
                  </div>
                  <div className="reason-row">
                    {item.reasons.map((r) => (
                      <span key={r} className="reason-chip">
                        {r}
                      </span>
                    ))}
                    <span className="reason-chip subtle">
                      テストまで {daysLeft(item.subject.testDate, today)} 日
                    </span>
                  </div>
                  <button className="primary full" onClick={() => onRecord(item.chapter.id)}>
                    終わった → 記録する
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
