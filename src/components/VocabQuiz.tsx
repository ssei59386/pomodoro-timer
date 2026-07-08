import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { getTodaysVocabChunks } from "../logic";
import { resolveTemplate } from "../data/subjectTemplates";

// 「完璧になった」は復元不能（取り消し手段が範囲丸ごと削除＝進捗全消去しかない）ため、
// 誤タップ即確定を避ける2段階確認にする。この待ち時間を過ぎたら確認状態を自動解除する
// （ux-reviewer指摘）。
const COMPLETE_CONFIRM_TIMEOUT_MS = 3000;

// 仕様書拡張：暗記科目（英語・社会・国語）のクイズ的UI（docs/feature-memorization.md 確定設計v3/v4）。
// 単語・重要語・漢字/古文単語の意味は一切表示しない。枠（20項目ずつ）の範囲番号だけを見せて、
// 生徒が単語帳・教科書側で実際に勉強したうえで「まだ完璧じゃない」「完璧になった」の二値を申告する
// （正誤判定ではなく達成度合いの自己申告。旧「わかった/わからなかった」というフレーミングとは意味が異なる）。
// 既存の SessionRecord とは記録するデータの形が違う（StudySession ではなく VocabChunk の
// Leitner箱を1件ずつ進める／完了フラグを立てる）ため、あえて共有コンポーネント化しない。
export function VocabQuiz({
  subjectId,
  onDone,
}: {
  subjectId: string;
  onDone: () => void;
}) {
  const { data, advanceVocabChunk, completeVocabChunk } = useStore();
  const today = useMemo(() => new Date(), []);

  const subject = useMemo(
    () => data.subjects.find((s) => s.id === subjectId),
    [data.subjects, subjectId],
  );
  // subject が見つからない（データ不整合など）ケース向けのフォールバック表示名は
  // 元 vocabLabels.ts の DEFAULT_VOCAB_HEADING/DEFAULT_VOCAB_ITEM_WORD と同じ値を維持する。
  const heading = subject ? resolveTemplate(subject).vocabHeading : "今日の暗記";
  const itemWord = subject ? resolveTemplate(subject).vocabItemWord : "暗記事項";

  // どのカードから開いたかで出題対象をその教科の暗記範囲だけに絞り込む（修正1、
  // docs/feature-memorization.md）。以前は data.vocabRanges を教科問わずそのまま渡していたため、
  // 社会カードを押しても英語・国語の枠が混ざる設計矛盾があった。
  const rangesForSubject = useMemo(
    () => data.vocabRanges.filter((r) => r.subjectId === subjectId),
    [data.vocabRanges, subjectId],
  );

  // 出題キューはマウント時の1回だけ計算し、以降は固定する。回答するたびに store の
  // vocabChunks（introduced/box/completed）が変わり、それを毎回 getTodaysVocabChunks で
  // 再計算してしまうと、途中で対象枠の構成そのものが変わって出題順・件数がずれてしまうため
  // （例：新規の枠に回答した瞬間、未着手数が減ってペース計算の母数が変わる）。
  const [queue] = useState(() => {
    const todaysChunks = getTodaysVocabChunks(rangesForSubject, data.vocabChunks, data.subjects, today);
    // 出題順は新規学習分を先に、復習分をあとに（新規のほうが番号が若い順で並んでいて把握しやすいため）
    return [...todaysChunks.newChunks, ...todaysChunks.reviewChunks];
  });
  const [index, setIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  // 「完璧になった」の2段階確認状態。true の間は同じボタンをもう一度タップすると確定する。
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const confirmTimerRef = useRef<number | null>(null);

  const clearConfirmTimer = () => {
    if (confirmTimerRef.current !== null) {
      window.clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  };

  // アンマウント時にタイマーが残らないようにする（他画面に移動した後の setState を防ぐ）
  useEffect(() => clearConfirmTimer, []);

  const rangeById = useMemo(
    () => new Map(data.vocabRanges.map((r) => [r.id, r])),
    [data.vocabRanges],
  );

  const total = queue.length;
  const current = queue[index];

  const answerStillReviewing = () => {
    // 確認状態の途中でも「まだ完璧じゃない」を押せば、その意思表示として通常通り記録する
    // （index が進むことで確認表示は自然に消える）。
    clearConfirmTimer();
    setConfirmingComplete(false);
    advanceVocabChunk(current.id);
    setIndex((i) => i + 1);
  };

  const answerCompleted = () => {
    if (!confirmingComplete) {
      setConfirmingComplete(true);
      clearConfirmTimer();
      confirmTimerRef.current = window.setTimeout(() => {
        setConfirmingComplete(false);
        confirmTimerRef.current = null;
      }, COMPLETE_CONFIRM_TIMEOUT_MS);
      return;
    }
    clearConfirmTimer();
    setConfirmingComplete(false);
    completeVocabChunk(current.id);
    setCompletedCount((c) => c + 1);
    setIndex((i) => i + 1);
  };

  if (total === 0) {
    return (
      <div className="screen">
        <div className="screen-head">
          <h2>{heading}</h2>
        </div>
        <div className="empty">
          <p>今日取り組む{itemWord}はありません。</p>
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
          <h2>{heading}：完了</h2>
        </div>
        <p className="muted">
          {total}枠中 {completedCount}枠が「完璧になった」でした。おつかれさまでした。
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
        <h2>{heading}</h2>
        <p className="muted">
          {index + 1} / {total} 枠目
        </p>
      </div>

      <div className="card vocab-quiz-card">
        {/* ラベルは「どの単語帳/レッスンの話か」を判断する唯一の手がかりなので、番号より
            目立たせる（ux-reviewer指摘：以前は muted small で一番地味だった） */}
        {range && <h3 className="vocab-quiz-label">{range.label}</h3>}
        <span className={isNew ? "reason-chip" : "reason-chip subtle"}>
          {isNew ? "新規" : "復習"}
        </span>
        <p className="vocab-quiz-number">
          {current.startNumber}〜{current.endNumber} 番
        </p>
        <p className="muted small">
          単語帳・教科書・プリントなどでこの範囲の{itemWord}を確認し、わからなかった{itemWord}には自分で印をつけながら覚えてください。
        </p>
      </div>

      <div className="vocab-quiz-actions">
        <button type="button" className="secondary" onClick={answerStillReviewing}>
          まだ完璧じゃない
        </button>
        <button
          type="button"
          className={confirmingComplete ? "primary vocab-confirm-pending" : "primary"}
          onClick={answerCompleted}
        >
          {confirmingComplete ? "本当に完璧？もう一度タップで確定" : "完璧になった"}
        </button>
      </div>
    </div>
  );
}
