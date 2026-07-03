import { useMemo, useState } from "react";
import { useStore } from "../store";
import { getTodaysVocabItems } from "../logic";

// 仕様書拡張：英単語暗記のクイズ的UI（docs/feature-memorization.md 確定設計v2）。
// 単語の意味は一切表示しない。番号だけを見せて「わかった/わからなかった」を記録する
// （生徒が単語帳・教科書側でその番号の単語を確認してから答える前提）。
// 既存の SessionRecord とは記録するデータの形が違う（StudySession ではなく VocabItem の
// Leitner箱を1件ずつ進める）ため、あえて共有コンポーネント化しない。
export function VocabQuiz({ onDone }: { onDone: () => void }) {
  const { data, recordVocabAnswer } = useStore();
  const today = useMemo(() => new Date(), []);

  // 出題キューはマウント時の1回だけ計算し、以降は固定する。回答するたびに store の
  // vocabItems（introduced/box）が変わり、それを毎回 getTodaysVocabItems で
  // 再計算してしまうと、途中で対象アイテムの構成そのものが変わって出題順・件数が
  // ずれてしまうため（例：新規アイテムに回答した瞬間、未着手数が減ってペース計算の
  // 母数が変わる）。
  const [queue] = useState(() => {
    const todaysItems = getTodaysVocabItems(data.vocabRanges, data.vocabItems, data.subjects, today);
    // 出題順は新規学習分を先に、復習分をあとに（新規のほうが番号が若い順で並んでいて把握しやすいため）
    return [...todaysItems.newItems, ...todaysItems.reviewItems];
  });
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const rangeById = useMemo(
    () => new Map(data.vocabRanges.map((r) => [r.id, r])),
    [data.vocabRanges],
  );

  const total = queue.length;
  const current = queue[index];

  const answer = (wasCorrect: boolean) => {
    recordVocabAnswer(current.id, wasCorrect);
    if (wasCorrect) setCorrectCount((c) => c + 1);
    setIndex((i) => i + 1);
  };

  if (total === 0) {
    return (
      <div className="screen">
        <div className="screen-head">
          <h2>今日の単語</h2>
        </div>
        <div className="empty">
          <p>今日取り組む単語はありません。</p>
          <button className="secondary" onClick={onDone}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="screen">
        <div className="screen-head">
          <h2>今日の単語：完了</h2>
        </div>
        <p className="muted">
          {total}問中 {correctCount}問「わかった」でした。おつかれさまでした。
        </p>
        <button type="button" className="primary big" onClick={onDone}>
          ホームに戻る
        </button>
      </div>
    );
  }

  const range = rangeById.get(current.rangeId);
  const isNew = !current.introduced;

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>今日の単語</h2>
        <p className="muted">
          {index + 1} / {total} 問目
        </p>
      </div>

      <div className="card vocab-quiz-card">
        {/* ラベルは「どの単語帳/レッスンの話か」を判断する唯一の手がかりなので、番号より
            目立たせる（ux-reviewer指摘：以前は muted small で一番地味だった） */}
        {range && <h3 className="vocab-quiz-label">{range.label}</h3>}
        <span className={isNew ? "reason-chip" : "reason-chip subtle"}>
          {isNew ? "新規" : "復習"}
        </span>
        <p className="vocab-quiz-number">{current.number} 番</p>
        <p className="muted small">単語帳・教科書でこの番号の単語を確認してから答えてください。</p>
      </div>

      <div className="vocab-quiz-actions">
        <button type="button" className="secondary" onClick={() => answer(false)}>
          わからなかった
        </button>
        <button type="button" className="primary" onClick={() => answer(true)}>
          わかった
        </button>
      </div>
    </div>
  );
}
