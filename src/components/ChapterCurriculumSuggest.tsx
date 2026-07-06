import { useEffect, useRef, useState } from "react";
import { searchCurriculumChapters } from "../data/curriculumSearch";

// 章名の入力中に、カリキュラム参考データからあいまい一致で候補をサジェストするドロップダウン。
// CurriculumSuggest.tsx（小項目名用）と異なり、章の難易度は3段階の手動選択のまま自動入力しない方針
// のため、onSelect は持たない。候補クリックは「これは実在する単元名です」という確認表示の役割のみで、
// どのフィールドも書き換えず、ドロップダウンを閉じるだけにする。
//
// 章名の入力欄はこのコンポーネントの外（呼び出し側）にあり兄弟要素として並ぶため、ドロップダウン自身に
// onBlur を付けても入力欄からのフォーカス移動は拾えない（bubbleするのは入力欄の祖先のみ）。そのため
// 「ドロップダウンの外側をクリック/タップしたら閉じる」document 監視に一本化し、章の追加ボタンを押す・
// 別の要素にフォーカスが移るなど、候補を選ばずに操作が進んだ場合も確実に閉じるようにしている。

const MIN_QUERY_LENGTH = 2;
const SUGGEST_LIMIT = 5;

interface ChapterCurriculumSuggestProps {
  query: string;
  subject: "数学" | "理科";
}

export function ChapterCurriculumSuggest({ query, subject }: ChapterCurriculumSuggestProps) {
  const [closedQuery, setClosedQuery] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const trimmed = query.trim();
  const shouldSearch = trimmed.length >= MIN_QUERY_LENGTH;
  const closed = closedQuery !== null && closedQuery === trimmed;
  const open = shouldSearch && !closed;

  useEffect(() => {
    if (!open) return;
    // 章名フィールド（入力欄＋このドロップダウン）の外側をクリックしたら閉じる。
    // ドロップダウンの親要素が入力欄と共通の枠なので、その枠の外かどうかで判定する。
    //
    // mousedown ではなく click で監視する。候補リストは通常のドキュメントフロー表示
    // （position: absolute のオーバーレイではない）なので、mousedown 時点で閉じて
    // 再レンダーするとリストが消えて後続要素が詰め上がり、レイアウトシフトが起きる。
    // その状態でmouseupを迎えると、タップしたかった別要素の座標がずれてclickが
    // 発火せず「1回目のタップが無視される」不具合になる。click はブラウザの発火順序上
    // 対象要素のmousedown→mouseup→clickが完了してからdocumentまでバブリングするため、
    // 対象要素自身のonClickが先に実行されたあとにここで閉じることになり干渉しない。
    const handleOutsideClick = (e: MouseEvent) => {
      const field = listRef.current?.parentElement;
      if (field && e.target instanceof Node && !field.contains(e.target)) {
        setClosedQuery(trimmed);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [open, trimmed]);

  if (!open) return null;

  const results = searchCurriculumChapters(trimmed, { subject, limit: SUGGEST_LIMIT });
  if (results.length === 0) return null;

  return (
    <div className="curriculum-suggest-list" role="listbox" ref={listRef}>
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
          <span className="curriculum-suggest-meta">{result.subject}・参考</span>
        </button>
      ))}
    </div>
  );
}
