import { useState } from "react";
import type { TimeSlot } from "../../types";
import { DateOverridesList } from "../DateOverridesList";

interface Props {
  value: Record<string, TimeSlot[]>;
  onChange: (value: Record<string, TimeSlot[]>) => void;
}

export function OnboardingStepOverrides({ value, onChange }: Props) {
  // 既に何か登録済みならいきなり展開しておく（せっかく入れた内容をまた1クリックで隠さない）
  const [expanded, setExpanded] = useState(Object.keys(value).length > 0);

  return (
    <section className="card">
      {expanded ? (
        <DateOverridesList value={value} onChange={onChange} />
      ) : (
        <button type="button" className="secondary" onClick={() => setExpanded(true)}>
          特別な予定を設定する
        </button>
      )}
    </section>
  );
}
