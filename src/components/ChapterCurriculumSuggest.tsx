import { useState } from "react";
import { searchCurriculumChapters } from "../data/curriculumSearch";

// 章名の入力中に、カリキュラム参考データからあいまい一致で候補をサジェストするドロップダウン。
// CurriculumSuggest.tsx（小項目名用）と異なり、章の難易度は3段階の手動選択のまま自動入力しない方針
// のため、onSelect は持たない。候補クリックは「これは実在する単元名です」という確認表示の役割のみで、
// どのフィールドも書き換えず、ドロップダウンを閉じるだけにする。
//
// 表示・クローズ管理のロジックは CurriculumSuggest.tsx と同一の安全策を踏襲する
// （onMouseDown + preventDefault、onBlur の遅延クローズ、closedQuery による再表示制御）。

const MIN_QUERY_LENGTH = 2;
const SUGGEST_LIMIT = 5;

interface ChapterCurriculumSuggestProps {
  query: string;
  subject: "数学" | "理科";
}

export function ChapterCurriculumSuggest({ query, subject }: ChapterCurriculumSuggestProps) {
  const [closedQuery, setClosedQuery] = useState<string | null>(null);

  const trimmed = query.trim();
  const shouldSearch = trimmed.length >= MIN_QUERY_LENGTH;
  const closed = closedQuery !== null && closedQuery === trimmed;

  if (!shouldSearch || closed) return null;

  const results = searchCurriculumChapters(trimmed, { subject, limit: SUGGEST_LIMIT });
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
          key={`${result.chapterName}-${i}`}
          type="button"
          className="curriculum-suggest-item"
          onMouseDown={(e) => {
            e.preventDefault();
            setClosedQuery(trimmed);
          }}
        >
          <span className="curriculum-suggest-name">{result.chapterName}</span>
          <span className="curriculum-suggest-meta">
            {result.block}（{result.subject}）
          </span>
        </button>
      ))}
    </div>
  );
}
