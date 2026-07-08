import type { DraftSubject } from "./onboardingTypes";

interface Props {
  /** ステップ0で追加した教科インスタンス（追加順に並んでいる想定） */
  subjects: DraftSubject[];
  onChange: (instanceId: string, date: string) => void;
}

// ステップ1：テスト日を登録。追加した教科インスタンスの数ぶんだけ表示する。
// 複数テスト日（1教科に複数回のテスト）の本対応は今回スコープ外だが、教科ごとに1ブロックとして
// 描く構造にしておくことで、将来「＋ テスト日を追加」を足しやすくしてある
// （docs/feature-onboarding-wizard.md、過剰実装はしない）。
export function OnboardingStepTestDates({ subjects, onChange }: Props) {
  return (
    <section className="card">
      {subjects.map((s) => (
        <div key={s.instanceId} className="test-date-block">
          <label className="field">
            <span>{s.name}のテスト日</span>
            <input type="date" value={s.testDate} onChange={(e) => onChange(s.instanceId, e.target.value)} />
          </label>
        </div>
      ))}
    </section>
  );
}
