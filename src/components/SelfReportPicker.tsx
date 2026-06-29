// 5段階の自己申告（手応え）を選ぶ共通 UI。
export const DEFAULT_LABELS = ["全然", "あまり", "ふつう", "できる", "完璧"];

export function SelfReportPicker({
  value,
  onChange,
  labels = DEFAULT_LABELS,
}: {
  value: number;
  onChange: (value: number) => void;
  labels?: string[];
}) {
  return (
    <div className="self-report-picker" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={value === n ? "sr-option selected" : "sr-option"}
          onClick={() => onChange(n)}
        >
          <span className="sr-num">{n}</span>
          <span className="sr-text">{labels[n - 1]}</span>
        </button>
      ))}
    </div>
  );
}
