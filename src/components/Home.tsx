import { useMemo } from "react";
import { useStore } from "../store";
import {
  generateTodayPlan,
  getTodaysVocabChunks,
  estimateVocabMinutes,
  daysLeft,
  availableMinutesForDate,
} from "../logic";
import type { Chapter, ChapterSubtopic } from "../types";
import { VOCAB_HEADING_BY_SUBJECT, VOCAB_ITEM_WORD_BY_SUBJECT } from "./vocabLabels";

// logic.ts の buildSubtopicReasons が生成するラベルと一致させる。
// 通常の理由チップ列からは除外し、カード上部の独立したバッジとして目立たせる表示専用の分岐。
const HINT_REASON_LABEL = "先生のヒントあり";

// VOCAB_HEADING_BY_SUBJECT に無い教科（数学・理科）は暗記カードの対象外。

// 仕様書 §7.2 ホーム（今日やること）
export function Home({
  onRecord,
  onGoSettings,
  onVocabQuiz,
}: {
  onRecord: (chapterId?: string, subtopicId?: string) => void;
  onGoSettings: () => void;
  onVocabQuiz: (subjectId: string) => void;
}) {
  const { data } = useStore();
  const today = useMemo(() => new Date(), []);

  const todayMinutes = useMemo(
    () => availableMinutesForDate(data.availability, today),
    [data.availability, today],
  );

  const plan = useMemo(
    () => generateTodayPlan(data.chapters, data.subjects, todayMinutes, today, data.sessions),
    [data.chapters, data.subjects, todayMinutes, today, data.sessions],
  );

  const totalMinutes = plan.reduce((sum, p) => sum + p.allocatedMinutes, 0);

  // 暗記科目（英語・社会・国語、docs/feature-memorization.md）: 既存の generateTodayPlan とは
  // 独立した別ロジック系統なので、暗記カードは plan 配列には混ぜず、表示側でリストの項目として足す。
  // 教科ごとに1枚のカードへ分ける（ux要件：1教科に複数の暗記範囲があっても合算表示にはしない）ため、
  // 教科ごとに範囲を絞ってから getTodaysVocabChunks を呼ぶ。
  const vocabBySubject = useMemo(() => {
    return data.subjects
      .filter((subject) => VOCAB_HEADING_BY_SUBJECT[subject.name])
      .map((subject) => {
        const rangesForSubject = data.vocabRanges.filter((r) => r.subjectId === subject.id);
        const todaysChunks = getTodaysVocabChunks(rangesForSubject, data.vocabChunks, [subject], today);
        const chunkCount = todaysChunks.newChunks.length + todaysChunks.reviewChunks.length;
        return { subject, todaysChunks, chunkCount, minutes: estimateVocabMinutes(chunkCount) };
      })
      .filter((v) => v.chunkCount > 0);
  }, [data.subjects, data.vocabRanges, data.vocabChunks, today]);
  const hasVocab = vocabBySubject.length > 0;

  // 小項目が対象のカードでは章全体のメタデータ（範囲・演習問題数・小項目一覧）を表示しない。
  // どの単位の情報か曖昧になり誤解を招くため。
  const buildDetailLine = (chapter: Chapter, subtopic: ChapterSubtopic | null) => {
    if (subtopic) return null;
    const parts: string[] = [];
    if (chapter.metadata?.learningScope) {
      parts.push(`範囲: ${chapter.metadata.learningScope}`);
    }
    if (chapter.metadata?.exerciseCount) {
      parts.push(`演習問題 ${chapter.metadata.exerciseCount}問`);
    }
    if (chapter.subtopics && chapter.subtopics.length > 0) {
      parts.push(`小項目: ${chapter.subtopics.map((s) => s.name).join("、")}`);
    }
    return parts.length > 0 ? parts.join(" ・ ") : null;
  };

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>今日やること</h2>
        <p className="muted">
          配点・理解度・テストまでの近さから、優先度の高い章や小項目を割り当てています。
        </p>
      </div>

      {plan.length === 0 && !hasVocab ? (
        <div className="empty">
          {data.chapters.length === 0 ? (
            <>
              <p>まだ章が登録されていません。</p>
              <button className="secondary" onClick={onGoSettings}>
                設定で章を登録する
              </button>
            </>
          ) : todayMinutes <= 0 ? (
            <>
              <p>今日は勉強できる時間が設定されていません。</p>
              <button className="secondary" onClick={onGoSettings}>
                設定で予定を確認する
              </button>
            </>
          ) : (
            <p>🎉 今日はすべての章が目標理解度に届いています。</p>
          )}
        </div>
      ) : (
        <>
          {plan.length === 0 && (
            <p className="muted">🎉 今日はすべての章が目標理解度に届いています。</p>
          )}
          {plan.length > 0 && (
            <div className="summary-pill">
              合計 {totalMinutes} 分 / {todayMinutes} 分・{plan.length} 件
            </div>
          )}
          <ul className="plan-list">
            {vocabBySubject.map(({ subject, todaysChunks, minutes }) => {
              const heading = VOCAB_HEADING_BY_SUBJECT[subject.name];
              const itemWord = VOCAB_ITEM_WORD_BY_SUBJECT[subject.name];
              return (
                <li key={`vocab-${subject.id}`} className="plan-card vocab-plan-card">
                  <div className="plan-card-top">
                    <div>
                      <span className="subject-tag">{subject.name}</span>
                      <h3>{heading}</h3>
                      <p className="muted small">
                        新規 {todaysChunks.newChunks.length} 枠・復習 {todaysChunks.reviewChunks.length} 枠
                      </p>
                      {todaysChunks.hasBacklog && (
                        <p className="muted small vocab-backlog-note">
                          間が空いたので、いつもより多めに出ています。焦らず少しずつで大丈夫です。
                        </p>
                      )}
                    </div>
                    <div className="plan-minutes">
                      {minutes.lowMinutes === minutes.highMinutes
                        ? `約${minutes.lowMinutes}分`
                        : `約${minutes.lowMinutes}〜${minutes.highMinutes}分`}
                    </div>
                  </div>
                  {/* この前提を知らないままクイズ画面に入ってしまうと戸惑うため、「始める」を
                      押す前にここで伝える（ux-reviewer指摘）。読み飛ばされやすい muted small
                      ではなく通常サイズ・通常色に格上げする（ux-reviewer指摘、2026-07-03）。 */}
                  <p className="vocab-plan-note">
                    ※{itemWord}の意味はここには出ません。単語帳・教科書・プリントなどを見ながら勉強し、わからなかった{itemWord}に印をつけてください。
                  </p>
                  {/* どの教科カードの「始める」を押したかで、クイズの出題対象をその教科の暗記範囲
                      だけに絞り込む（修正1、docs/feature-memorization.md）。以前は全教科の
                      VocabRange を1つのキューに混ぜて出題しており、社会カードを押しても英語・
                      国語が混ざる設計矛盾があった。 */}
                  <button
                    type="button"
                    className="primary full"
                    onClick={() => onVocabQuiz(subject.id)}
                  >
                    始める
                  </button>
                </li>
              );
            })}
            {plan.map((item, index) => {
              const detailLine = buildDetailLine(item.chapter, item.subtopic);
              const previousItem = plan[index - 1];
              const sameChapterAsPrevious = previousItem?.chapter.id === item.chapter.id;
              const hasTeacherHint = item.reasons.includes(HINT_REASON_LABEL);
              const visibleReasons = item.reasons.filter((r) => r !== HINT_REASON_LABEL);
              return (
                <li key={`${item.chapter.id}-${item.subtopic?.id ?? "chapter"}`} className="plan-card">
                  <div className="plan-card-top">
                    <div>
                      <span className="subject-tag">{item.subject.name}</span>
                      {hasTeacherHint && (
                        <span className="teacher-hint-badge">📌 先生のヒント</span>
                      )}
                      {sameChapterAsPrevious && item.subtopic ? (
                        <>
                          <p className="plan-chapter-continued muted small">
                            {item.chapter.name}の続き
                          </p>
                          <h3>{item.subtopic.name}</h3>
                        </>
                      ) : (
                        <>
                          <h3>{item.chapter.name}</h3>
                          {item.subtopic && (
                            <p className="plan-subtopic-name">→ {item.subtopic.name}</p>
                          )}
                        </>
                      )}
                      {detailLine && <p className="muted small">{detailLine}</p>}
                    </div>
                    <div className="plan-minutes">{item.allocatedMinutes}分</div>
                  </div>
                  <div className="reason-row">
                    {visibleReasons.map((r) => (
                      <span key={r} className="reason-chip">
                        {r}
                      </span>
                    ))}
                    <span className="reason-chip subtle">
                      テストまで {daysLeft(item.subject.testDate, today)} 日
                    </span>
                  </div>
                  <button
                    className="primary full"
                    onClick={() => onRecord(item.chapter.id, item.subtopic?.id)}
                  >
                    終わった → 記録する
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
