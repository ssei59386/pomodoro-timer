import { useState } from "react";
import {
  searchCurriculumSubtopics,
  type CurriculumSearchResult,
} from "../data/curriculumSearch";

// 小項目名の入力中に、カリキュラム参考データからあいまい一致で候補をサジェストするドロップダウン。
// 表示・選択イベントの発火のみ担当し、選ばれた結果をどう使うか（名前を上書きするか、
// 難易度をどこに保存するか）は呼び出し側（Onboarding.tsx / Settings.tsx）の責務とする。
//
// フォーカスが外れたら閉じたいが、候補クリックがそれより先に成立する必要があるため、
// 候補ボタンは onMouseDown（onBlur より先に発火）で処理し、コンテナ div の onBlur で閉じる。
// 選択後 closedQuery に現在の query を記録しておき、query が再度変わったら（＝ユーザーが
// 打ち直したら）自動的に候補を出し直す。
//
// モバイル実機ではタッチイベントの順序が onMouseDown の preventDefault だけでは
// 確実に選択より先に閉じてしまうケースがあるため、onBlur は即座に閉じず少し遅延させる
// （onMouseDown 側の対策と合わせた二重の安全策）。

const MIN_QUERY_LENGTH = 2;
const SUGGEST_LIMIT = 3;

interface CurriculumSuggestProps {
  query: string;
  subject: "数学" | "理科";
  onSelect: (result: CurriculumSearchResult) => void;
}

export function CurriculumSuggest({ query, subject, onSelect }: CurriculumSuggestProps) {
  const [closedQuery, setClosedQuery] = useState<string | null>(null);

  const trimmed = query.trim();
  const shouldSearch = trimmed.length >= MIN_QUERY_LENGTH;
  const closed = closedQuery !== null && closedQuery === trimmed;

  if (!shouldSearch || closed) return null;

  const results = searchCurriculumSubtopics(trimmed, { subject, limit: SUGGEST_LIMIT });
  if (results.length === 0) return null;

  return (
    <div
      className="curriculum-suggest-list"
      role="listbox"
      onBlur={() => {
        setTimeout(() => setClosedQuery(trimmed), 150);
      }}
    >
      {results.map((result, i) => (
        <button
          key={`${result.chapterName}-${result.subtopicName}-${i}`}
          type="button"
          className="curriculum-suggest-item"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(result);
            setClosedQuery(trimmed);
          }}
        >
          <span className="curriculum-suggest-name">{result.subtopicName}</span>
          <span className="curriculum-suggest-badge">難易度{result.difficultyLevel}</span>
        </button>
      ))}
    </div>
  );
}
