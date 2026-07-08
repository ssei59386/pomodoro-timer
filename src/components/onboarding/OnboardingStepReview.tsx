export interface ReviewSubjectSummary {
  instanceId: string;
  label: string;
  testDate: string;
  chapterCount: number;
  vocabRangeCount: number;
}

interface Props {
  subjects: ReviewSubjectSummary[];
  weeklyTotalMinutes: number;
  overrideDayCount: number;
  onEditTestDates: () => void;
  onEditSubjectContent: (instanceId: string) => void;
  onEditSchedule: () => void;
  onEditOverrides: () => void;
}

// 確認画面：本格ウィザードで失う「全体を一覧できる／後から自由に直せる」自由さの埋め合わせ
// （docs/feature-onboarding-wizard.md）。読み取り専用のサマリーに、各項目から該当ステップへ
// 戻れる「編集」ボタンを添える。
export function OnboardingStepReview({
  subjects,
  weeklyTotalMinutes,
  overrideDayCount,
  onEditTestDates,
  onEditSubjectContent,
  onEditSchedule,
  onEditOverrides,
}: Props) {
  return (
    <section className="card review-card">
      <div className="review-row">
        <div className="review-row-body">
          <span className="review-row-title">テスト日</span>
          <span className="muted small">
            {subjects.map((s) => `${s.label} ${s.testDate || "未設定"}`).join(" ／ ")}
          </span>
        </div>
        <button type="button" className="link-btn" onClick={onEditTestDates}>
          編集
        </button>
      </div>

      {subjects.map((s) => (
        <div key={s.instanceId} className="review-row">
          <div className="review-row-body">
            <span className="review-row-title">{s.label}</span>
            <span className="muted small">
              章 {s.chapterCount} 件 ／ 暗記範囲 {s.vocabRangeCount} 件
            </span>
          </div>
          <button type="button" className="link-btn" onClick={() => onEditSubjectContent(s.instanceId)}>
            編集
          </button>
        </div>
      ))}

      <div className="review-row">
        <div className="review-row-body">
          <span className="review-row-title">勉強できる時間</span>
          <span className="muted small">週合計 {weeklyTotalMinutes} 分</span>
        </div>
        <button type="button" className="link-btn" onClick={onEditSchedule}>
          編集
        </button>
      </div>

      <div className="review-row">
        <div className="review-row-body">
          <span className="review-row-title">特別な予定</span>
          <span className="muted small">{overrideDayCount} 日 登録</span>
        </div>
        <button type="button" className="link-btn" onClick={onEditOverrides}>
          編集
        </button>
      </div>
    </section>
  );
}
