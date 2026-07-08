import type { UnderstandingLevel } from "../data/studyPolicy";

// 達成段階（1〜5）を選ぶピッカー（段階4：教科の複数登録＋理解度の達成段階化）。
// SelfReportPicker（手応え5段階）の置き換え。操作性は踏襲する（role=radiogroup/radio、
// aria-checked、44pxタップ）が、ラベルが「達成したこと」の一文になり長文化するため、
// SelfReportPicker の横並び10pxテキスト（.sr-text、可読性が低いと既知）は使わず、
// 縦積み・折り返し可能なレイアウトにする。
export function AchievementLevelPicker({
  value,
  onChange,
  levels,
}: {
  value: number;
  onChange: (value: number) => void;
  levels: UnderstandingLevel[];
}) {
  return (
    <div className="achievement-level-picker" role="radiogroup">
      {levels.map((lv) => (
        <button
          key={lv.level}
          type="button"
          role="radio"
          aria-checked={value === lv.level}
          className={value === lv.level ? "al-option selected" : "al-option"}
          onClick={() => onChange(lv.level)}
        >
          <span className="al-num">{lv.level}</span>
          <span className="al-body">
            <span className="al-achieved">{lv.achieved}</span>
            <span className="al-next">次：{lv.next}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
