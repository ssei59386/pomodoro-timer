import { useEffect, useState } from "react";
import { useStore } from "../store";
import { toISODate } from "../logic";
import { SelfReportPicker } from "./SelfReportPicker";

// 仕様書 §7.3 セッション記録
// 対象の章を選び、かけた時間・演習の正答率・手応え（5段階）を入力 → 保存で理解度更新（§6.1）
export function SessionRecord({
  preselectChapterId,
  onDone,
}: {
  preselectChapterId: string | null;
  onDone: () => void;
}) {
  const { data, recordSession } = useStore();

  const [chapterId, setChapterId] = useState<string>(
    preselectChapterId ?? data.chapters[0]?.id ?? "",
  );
  const [minutes, setMinutes] = useState(45);
  const [correctPercent, setCorrectPercent] = useState(70); // 0〜100% で入力
  const [selfReport, setSelfReport] = useState(3);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (preselectChapterId) setChapterId(preselectChapterId);
  }, [preselectChapterId]);

  const subjectName = (subjectId: string) =>
    data.subjects.find((s) => s.id === subjectId)?.name ?? "";

  const handleSave = () => {
    if (!chapterId) return;
    recordSession({
      chapterId,
      date: toISODate(new Date()),
      minutes,
      correctRate: correctPercent / 100,
      selfReport,
    });
    setSaved(true);
    // 軽いフィードバックの後にダッシュボードへ
    setTimeout(onDone, 700);
  };

  if (data.chapters.length === 0) {
    return (
      <div className="screen">
        <h2>セッション記録</h2>
        <p className="muted">先に章を登録してください（設定から追加できます）。</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>セッション記録</h2>
        <p className="muted">勉強した内容を記録すると、その章の理解度が更新されます。</p>
      </div>

      <label className="field">
        <span>勉強した章</span>
        <select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
          {data.chapters.map((c) => (
            <option key={c.id} value={c.id}>
              [{subjectName(c.subjectId)}] {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>かけた時間（分）</span>
        <input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
        />
      </label>

      <label className="field">
        <span>演習の正答率：{correctPercent}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={correctPercent}
          onChange={(e) => setCorrectPercent(Number(e.target.value))}
        />
      </label>

      <div className="self-report-block">
        <span className="self-report-label">手応え（自己申告）</span>
        <SelfReportPicker value={selfReport} onChange={setSelfReport} />
      </div>

      <button className="primary big" onClick={handleSave} disabled={saved}>
        {saved ? "保存しました ✓" : "記録して理解度を更新"}
      </button>
    </div>
  );
}
