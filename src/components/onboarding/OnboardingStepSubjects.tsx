import { SUBJECT_LABELS, SUBJECT_ORDER, type SubjectKey } from "./onboardingTypes";

interface Props {
  selectedSubjects: SubjectKey[];
  onChange: (next: SubjectKey[]) => void;
}

// ステップ0：使う教科を選ぶ。ここで選んだ教科だけが以降のステップの対象になる
// （「テスト日欄が5教科分ずらっと並ぶ」問題の根本解決、docs/feature-onboarding-wizard.md）。
export function OnboardingStepSubjects({ selectedSubjects, onChange }: Props) {
  const toggle = (key: SubjectKey) => {
    if (selectedSubjects.includes(key)) {
      onChange(selectedSubjects.filter((k) => k !== key));
    } else {
      onChange([...selectedSubjects, key]);
    }
  };

  return (
    <section className="card">
      <div className="subject-select-list">
        {SUBJECT_ORDER.map((key) => (
          <label key={key} className="subject-select-row">
            <input type="checkbox" checked={selectedSubjects.includes(key)} onChange={() => toggle(key)} />
            <span>{SUBJECT_LABELS[key]}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
