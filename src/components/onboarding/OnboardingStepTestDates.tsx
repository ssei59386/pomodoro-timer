import { SUBJECT_LABELS, type SubjectKey } from "./onboardingTypes";

interface Props {
  /** ステップ0で選んだ教科（表示順に並んでいる想定） */
  subjects: SubjectKey[];
  testDates: Partial<Record<SubjectKey, string>>;
  onChange: (subjectKey: SubjectKey, date: string) => void;
}

// ステップ1：テスト日を登録。選んだ教科の数ぶんだけ表示する。
// 複数テスト日（1教科に複数回のテスト）の本対応は今回スコープ外だが、教科ごとに1ブロックとして
// 描く構造にしておくことで、将来「＋ テスト日を追加」を足しやすくしてある
// （docs/feature-onboarding-wizard.md、過剰実装はしない）。
export function OnboardingStepTestDates({ subjects, testDates, onChange }: Props) {
  return (
    <section className="card">
      {subjects.map((key) => (
        <div key={key} className="test-date-block">
          <label className="field">
            <span>{SUBJECT_LABELS[key]}のテスト日</span>
            <input type="date" value={testDates[key] ?? ""} onChange={(e) => onChange(key, e.target.value)} />
          </label>
        </div>
      ))}
    </section>
  );
}
