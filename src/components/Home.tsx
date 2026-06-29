import { useMemo } from "react";
import { useStore } from "../store";
import { generateTodayPlan, daysLeft } from "../logic";

// 仕様書 §7.2 ホーム（今日やること）
export function Home({ onRecord }: { onRecord: (chapterId?: string) => void }) {
  const { data } = useStore();
  const today = useMemo(() => new Date(), []);

  const plan = useMemo(
    () =>
      generateTodayPlan(
        data.chapters,
        data.subjects,
        data.availability.dailyMinutes,
        today,
      ),
    [data.chapters, data.subjects, data.availability.dailyMinutes, today],
  );

  const totalMinutes = plan.reduce((sum, p) => sum + p.allocatedMinutes, 0);

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
          <p>今日割り当てる章がありません。</p>
          <p className="muted">
            すべての章が目標理解度に届いているか、勉強時間が 0 分です。
          </p>
        </div>
      ) : (
        <>
          <div className="summary-pill">
            合計 {totalMinutes} 分 / {data.availability.dailyMinutes} 分・{plan.length} 章
          </div>
          <ul className="plan-list">
            {plan.map((item) => (
              <li key={item.chapter.id} className="plan-card">
                <div className="plan-card-top">
                  <div>
                    <span className="subject-tag">{item.subject.name}</span>
                    <h3>{item.chapter.name}</h3>
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
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
