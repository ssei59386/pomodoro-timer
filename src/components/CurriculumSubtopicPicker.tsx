import { useState } from "react";
import { getCurriculumChapterSubtopics, searchCurriculumChapters } from "../data/curriculumSearch";

// 章名がカリキュラム参考データの章と一致するとき、その章の小項目候補一覧から
// チェックボックスで複数選択して一括追加するためのパネル。
//
// ChapterCurriculumSuggest（章名入力欄のドロップダウン）とはあえて別の独立したボタンにしている。
// 同じ見た目のクリック操作が状況によって違う挙動をするのは中高生ユーザーにとって予測不能なため
// （ux-reviewer指摘）。またモーダルは使わず常にインライン展開する
// （フォームが縦に長い中でモーダルを開くとスクロール位置を見失いやすいため）。

const SUGGEST_LIMIT = 1;

interface CurriculumSubtopicCandidate {
  name: string;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
}

interface CurriculumSubtopicPickerProps {
  chapterName: string;
  subject: "数学" | "理科";
  onAdd: (candidates: CurriculumSubtopicCandidate[]) => void;
}

export function CurriculumSubtopicPicker({
  chapterName,
  subject,
  onAdd,
}: CurriculumSubtopicPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const trimmed = chapterName.trim();
  if (!trimmed) return null;

  // あいまい一致で複数候補がある場合も、最もスコアの高い1件の小項目一覧だけを使う
  // （複数章から選ばせるUIはスコープ外）。
  const [match] = searchCurriculumChapters(trimmed, { subject, limit: SUGGEST_LIMIT });
  if (!match) return null;

  const candidates = getCurriculumChapterSubtopics(match.block, match.subject, match.chapterName);
  if (candidates.length === 0) return null;

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const chosen = candidates.filter((c) => selected.has(c.name));
    onAdd(chosen);
    setSelected(new Set());
    setIsOpen(false);
  };

  return (
    <div className="curriculum-subtopic-picker">
      <button type="button" className="link-btn" onClick={() => setIsOpen((prev) => !prev)}>
        候補から選ぶ
      </button>
      {isOpen && (
        <div className="subtopic-candidate-panel">
          <p className="muted small">
            {match.chapterName}（{match.block}）の小項目候補
          </p>
          {candidates.map((c) => (
            <label key={c.name} className="subtopic-candidate-row">
              <input
                type="checkbox"
                checked={selected.has(c.name)}
                onChange={() => toggle(c.name)}
              />
              <span>{c.name}</span>
              <span className="muted small">難易度{c.difficultyLevel}</span>
            </label>
          ))}
          <div className="subtopic-candidate-actions">
            <button
              type="button"
              className="secondary small"
              disabled={selected.size === 0}
              onClick={handleConfirm}
            >
              選択した小項目を追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
