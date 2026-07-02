import { useEffect, useState } from "react";
import { useStore } from "../store";
import { toISODate } from "../logic";
import { SelfReportPicker } from "./SelfReportPicker";

// 仕様書 §7.3 セッション記録
// 対象の章を選び、かけた時間・演習の正答率・手応え（5段階）を入力 → 保存で理解度更新（§6.1）

// select の「章全体として記録」オプション用の値。空文字列は未選択プレースホルダーに使うため、
// 実際の選択肢としては別の値を割り当て、onChange で subtopicId の空文字列に正規化する。
const WHOLE_CHAPTER_VALUE = "__whole_chapter__";

export function SessionRecord({
  preselectChapterId,
  onDone,
  onGoSettings,
}: {
  preselectChapterId: string | null;
  onDone: () => void;
  onGoSettings: () => void;
}) {
  const { data, recordSession } = useStore();

  const [chapterId, setChapterId] = useState<string>(
    preselectChapterId ?? data.chapters[0]?.id ?? "",
  );
  // 空文字列 = 未選択 or 「章全体として記録」（小項目を指定しない）。
  // select の初期値は空文字列だが、先頭に選択不可のプレースホルダーを置いて未選択を明示するため、
  // 「章全体として記録」オプション自体は別の値（WHOLE_CHAPTER_VALUE）を持たせ、
  // onChange で空文字列に正規化する。
  const [subtopicId, setSubtopicId] = useState<string>("");
  const [minutes, setMinutes] = useState(45);
  const [correctPercent, setCorrectPercent] = useState(70); // 0〜100% で入力
  const [selfReport, setSelfReport] = useState(3);
  // 未入力を許容する任意項目のため null 初期値（minutes 等の必須数値入力とは異なる）
  const [problemsCompleted, setProblemsCompleted] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (preselectChapterId) setChapterId(preselectChapterId);
  }, [preselectChapterId]);

  // 章を切り替えたら、別の章の小項目IDが残らないようにリセットする
  useEffect(() => {
    setSubtopicId("");
  }, [chapterId]);

  const subjectName = (subjectId: string) =>
    data.subjects.find((s) => s.id === subjectId)?.name ?? "";

  const selectedChapter = data.chapters.find((c) => c.id === chapterId);
  const subtopics = selectedChapter?.subtopics ?? [];

  const handleSave = () => {
    if (!chapterId) return;
    recordSession({
      chapterId,
      subtopicId: subtopicId || undefined,
      date: toISODate(new Date()),
      minutes,
      correctRate: correctPercent / 100,
      selfReport,
      problemsCompleted: problemsCompleted ?? undefined,
    });
    setSaved(true);
    // 軽いフィードバックの後にダッシュボードへ
    setTimeout(onDone, 700);
  };

  if (data.chapters.length === 0) {
    return (
      <div className="screen">
        <h2>セッション記録</h2>
        <div className="empty">
          <p className="muted">先に章を登録してください（設定から追加できます）。</p>
          <button className="secondary" onClick={onGoSettings}>
            設定で章を登録する
          </button>
        </div>
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

      {subtopics.length > 0 && (
        <label className="field">
          <span>小項目</span>
          <select
            value={subtopicId}
            onChange={(e) =>
              setSubtopicId(e.target.value === WHOLE_CHAPTER_VALUE ? "" : e.target.value)
            }
          >
            <option value="" disabled hidden>
              小項目を選んでください（章全体で記録する場合は下から選択）
            </option>
            {subtopics.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
            <option value={WHOLE_CHAPTER_VALUE}>章全体として記録</option>
          </select>
        </label>
      )}

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

      <label className="field">
        <span>解いた問題数</span>
        <input
          type="number"
          min={0}
          value={problemsCompleted ?? ""}
          onChange={(e) =>
            setProblemsCompleted(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))
          }
        />
        <span className="muted small">任意（基礎/発展の内訳は問いません）</span>
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
