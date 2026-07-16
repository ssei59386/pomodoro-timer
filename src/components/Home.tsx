import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import {
  buildPlanFromItemKeys,
  collectForecastDecisionPrompts,
  computeStreak,
  effectiveStudyMode,
  forecastDecisionKey,
  getTodaysVocabChunks,
  estimateVocabMinutes,
  daysLeft,
  availableMinutesForDate,
  toISODate,
  type ForecastDecisionPrompt,
} from "../logic";
import type { Chapter, ChapterSubtopic } from "../types";
import { resolveTemplate } from "../data/subjectTemplates";

// logic.ts の buildSubtopicReasons が生成するラベルと一致させる。
// 通常の理由チップ列からは除外し、カード上部の独立したバッジとして目立たせる表示専用の分岐。
const HINT_REASON_LABEL = "先生のヒントあり";

// vocabCapable が false の教科（数学・理科）は暗記カードの対象外。

// 仕様書 §7.2 ホーム（今日やること）
export function Home({
  onRecord,
  onGoSettings,
  onVocabQuiz,
  onShowStudyPolicy,
}: {
  onRecord: (chapterId?: string, subtopicId?: string) => void;
  onGoSettings: () => void;
  onVocabQuiz: (subjectId: string) => void;
  onShowStudyPolicy: () => void;
}) {
  const {
    data,
    ensureTodayPlan,
    evaluateForecastDecisions,
    continueDecision,
    switchToMemorizeMode,
    restoreUnderstandMode,
  } = useStore();
  // 既知の制約（今回はスコープ外、ux-reviewer指摘）: マウント時に1回だけ固定するため、
  // Homeタブを開きっぱなしのまま深夜0時をまたいでも today/todayISO は更新されず、
  // プランは翌日分に自動で切り替わらない。発生頻度が低く、可視性変化の監視などの実装コストに
  // 見合わないため今回は許容する。
  const today = useMemo(() => new Date(), []);
  const todayISO = useMemo(() => toISODate(today), [today]);

  // 「今日の計画」は開いた瞬間の対象集合で固定する。1件記録して除外されても、
  // 次善の項目が自動で滑り込んでこないようにするための仕様（対象の章/小項目の集合のみ固定、
  // 割当分数・理由チップは表示のたびに最新データから再計算する）。
  useEffect(() => {
    ensureTodayPlan(today);
    // todayISO のみを依存にする: today/ensureTodayPlan は毎レンダー新しい参照になり得るが、
    // 実行すべきタイミングは「日付が変わったとき」だけなので、それ以外での再実行は不要。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO]);

  // 後悔防止トリガー（Phase 2）：前向きシミュレーションに基づく連続shortfall日数を1日1回だけ更新する。
  // ensureTodayPlan と同じ理由で todayISO のみを依存にする（日付が変わったときだけ再評価すればよい）。
  useEffect(() => {
    evaluateForecastDecisions(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO]);

  const forecastDecisionPrompts = useMemo(
    () => collectForecastDecisionPrompts(data.chapters, data.forecastDecisions ?? {}, today),
    [data.chapters, data.forecastDecisions, today],
  );

  // 「切り替える」を選んだ直後の項目（このセッション中のみ）：問いかけカードと同じ場所に
  // 事後メッセージ＋「元に戻す」を出すための一時状態。切り替え済みの項目は studyMode が
  // 'memorize' になり forecastDecisionPrompts から自然に外れるため、ここで別枠に保持しないと
  // カード自体が消えてしまい取り消し手段が示せない（ux-reviewer指摘）。
  const [justSwitched, setJustSwitched] = useState<Record<string, ForecastDecisionPrompt>>({});

  const decisionCardEntries = useMemo(() => {
    const byKey = new Map<string, { prompt: ForecastDecisionPrompt; justSwitched: boolean }>();
    for (const prompt of forecastDecisionPrompts) {
      byKey.set(forecastDecisionKey(prompt.chapterId, prompt.subtopicId), { prompt, justSwitched: false });
    }
    for (const [key, prompt] of Object.entries(justSwitched)) {
      if (!byKey.has(key)) byKey.set(key, { prompt, justSwitched: true });
    }
    return Array.from(byKey.values());
  }, [forecastDecisionPrompts, justSwitched]);

  const handleSwitchToMemorize = (prompt: ForecastDecisionPrompt) => {
    switchToMemorizeMode(prompt.chapterId, prompt.subtopicId);
    setJustSwitched((prev) => ({
      ...prev,
      [forecastDecisionKey(prompt.chapterId, prompt.subtopicId)]: prompt,
    }));
  };

  const handleRestoreUnderstandMode = (prompt: ForecastDecisionPrompt) => {
    restoreUnderstandMode(prompt.chapterId, prompt.subtopicId);
    setJustSwitched((prev) => {
      const next = { ...prev };
      delete next[forecastDecisionKey(prompt.chapterId, prompt.subtopicId)];
      return next;
    });
  };

  const todayMinutes = useMemo(
    () => availableMinutesForDate(data.availability, today),
    [data.availability, today],
  );

  // 連続記録ストリーク（CEOプロダクト判断：控えめに後押しするだけで煽らない）。
  // 3日未満は何のシグナルにもならず、むしろ「たった1日で表示される」ことのほうが
  // プレッシャーに見えるため、3日以上のときだけDOMごと出す。
  const streak = useMemo(() => computeStreak(data.sessions, today), [data.sessions, today]);

  // todayPlan.date が今日と一致しない場合（日をまたいだ直後、ensureTodayPlan の
  // useEffect がまだ走っていないタイミングなど）は前日分のスナップショットを描画しない
  // ようにするガード（ux-reviewer指摘）。
  const todayItemKeys = data.todayPlan?.date === todayISO ? data.todayPlan.itemKeys : [];

  const plan = useMemo(
    () => buildPlanFromItemKeys(data.chapters, data.subjects, todayItemKeys, today, data.sessions),
    [data.chapters, data.subjects, todayItemKeys, today, data.sessions],
  );

  const totalMinutes = plan.reduce((sum, p) => sum + p.allocatedMinutes, 0);

  // todayItemKeys には対象があったのに plan が空 = 参照先の章/小項目がSettingsで
  // 削除された等の理由で消えたケース。最初から対象0件だった「目標理解度に届いている」
  // ケースと文言を分ける（ux-reviewer指摘）。
  const plannedItemsWentMissing = todayItemKeys.length > 0 && plan.length === 0;
  const emptyPlanMessage = plannedItemsWentMissing
    ? "今日予定していた章が見当たりません。設定で削除された可能性があります。"
    : "🎉 今日はすべての章が目標理解度に届いています。";

  /** 今日、その章(+小項目一致)のセッションが記録済みかどうか（完了判定は都度セッション記録から行う） */
  const isItemCompletedToday = (chapter: Chapter, subtopic: ChapterSubtopic | null) =>
    data.sessions.some(
      (s) =>
        s.date === todayISO &&
        s.chapterId === chapter.id &&
        (subtopic ? s.subtopicId === subtopic.id : !s.subtopicId),
    );

  const allPlanItemsCompleted = plan.length > 0 && plan.every((item) => isItemCompletedToday(item.chapter, item.subtopic));

  // 暗記科目（英語・社会・国語、docs/feature-memorization.md）: 既存の generateTodayPlan とは
  // 独立した別ロジック系統なので、暗記カードは plan 配列には混ぜず、表示側でリストの項目として足す。
  // 教科ごとに1枚のカードへ分ける（ux要件：1教科に複数の暗記範囲があっても合算表示にはしない）ため、
  // 教科ごとに範囲を絞ってから getTodaysVocabChunks を呼ぶ。
  const vocabBySubject = useMemo(() => {
    return data.subjects
      .filter((subject) => resolveTemplate(subject).vocabCapable)
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
          理解度・テストまでの近さから、優先度の高い章や小項目を割り当てています。
        </p>
        {streak >= 3 && <span className="streak-chip">{streak}日連続で記録中</span>}
        {/* 全部終わった後は「お疲れさま」メッセージの方が優先度が高いので、固定に関する説明文は
            隠してその分の画面上部を空ける（ux-reviewer P1指摘：完了後も毎回全文表示され続けていた）。 */}
        {plan.length > 0 && !allPlanItemsCompleted && (
          <p className="muted small">
            今日の計画は、今日最初に開いたときの内容で固定されています。設定を変更しても今日中は反映されず、明日から反映されます。
          </p>
        )}
      </div>

      {decisionCardEntries.length > 0 && (
        <ul className="forecast-decision-list">
          {decisionCardEntries.map(({ prompt, justSwitched: switched }) => (
            <ForecastDecisionCard
              key={forecastDecisionKey(prompt.chapterId, prompt.subtopicId)}
              prompt={prompt}
              chapters={data.chapters}
              subjects={data.subjects}
              justSwitched={switched}
              onContinue={() => continueDecision(prompt.chapterId, prompt.subtopicId, today)}
              onSwitchToMemorize={() => handleSwitchToMemorize(prompt)}
              onRestore={() => handleRestoreUnderstandMode(prompt)}
              onShowStudyPolicy={onShowStudyPolicy}
            />
          ))}
        </ul>
      )}

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
            <p>{emptyPlanMessage}</p>
          )}
        </div>
      ) : (
        <>
          {plan.length === 0 && <p>{emptyPlanMessage}</p>}
          {plan.length > 0 && (
            <div className="summary-pill">
              合計 {totalMinutes} 分 / {todayMinutes} 分・{plan.length} 件
            </div>
          )}
          {allPlanItemsCompleted && (
            <p className="muted plan-all-done-message">🎉 今日予定していた章の勉強は全部終わり！お疲れさま</p>
          )}
          <ul className="plan-list">
            {vocabBySubject.map(({ subject, todaysChunks, minutes }) => {
              const template = resolveTemplate(subject);
              const heading = template.vocabHeading;
              const itemWord = template.vocabItemWord;
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
              const isCompleted = isItemCompletedToday(item.chapter, item.subtopic);
              const isMemorizeMode = effectiveStudyMode(item.chapter, item.subtopic) === "memorize";
              return (
                <li
                  key={`${item.chapter.id}-${item.subtopic?.id ?? "chapter"}`}
                  className={isCompleted ? "plan-card completed" : "plan-card"}
                >
                  <div className="plan-card-top">
                    <div>
                      <span className="subject-tag">{item.subject.name}</span>
                      {isMemorizeMode && <span className="memorize-mode-badge">🧠 暗記モード</span>}
                      {hasTeacherHint && (
                        <span className="teacher-hint-badge">📌 先生のヒント</span>
                      )}
                      {sameChapterAsPrevious && item.subtopic ? (
                        <>
                          <p className="plan-chapter-continued muted small">
                            {item.chapter.name}の続き
                          </p>
                          <h3 className={isCompleted ? "plan-card-title-done" : undefined}>
                            {item.subtopic.name}
                          </h3>
                        </>
                      ) : (
                        <>
                          <h3 className={isCompleted ? "plan-card-title-done" : undefined}>
                            {item.chapter.name}
                          </h3>
                          {item.subtopic && (
                            <p
                              className={
                                isCompleted ? "plan-subtopic-name plan-card-title-done" : "plan-subtopic-name"
                              }
                            >
                              → {item.subtopic.name}
                            </p>
                          )}
                        </>
                      )}
                      {detailLine && <p className="muted small">{detailLine}</p>}
                    </div>
                    <div className="plan-card-top-right">
                      {isCompleted && <span className="plan-completed-badge">✓ 完了</span>}
                      <div className="plan-minutes">{item.allocatedMinutes}分</div>
                    </div>
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
                  {!isCompleted && (
                    <button
                      className="primary full"
                      onClick={() => onRecord(item.chapter.id, item.subtopic?.id)}
                    >
                      終わった → 記録する
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * 後悔防止トリガー（Phase 2）の「続ける/切り替える」問いかけカード。
 * 英語は「訳文を暗記する」、数学・理科は「解き方を覚える」と切り替え先の文言を出し分ける
 * （docs/feature-study-policy.md「切り替える」を選んだ後の挙動）。
 * デフォルト方針は「どれだけ時間をかけてもいい＝続ける」なので、視覚的に強い primary は
 * 「このまま続ける」側に付ける（切り替えるは中立な secondary。ux-reviewer指摘）。
 * justSwitched が true のときは、選択のやり直しがきくよう「元に戻す」ボタン付きの
 * 事後メッセージを同じ場所に表示する（取り消し手段。ux-reviewer指摘）。
 */
function ForecastDecisionCard({
  prompt,
  chapters,
  subjects,
  justSwitched,
  onContinue,
  onSwitchToMemorize,
  onRestore,
  onShowStudyPolicy,
}: {
  prompt: ForecastDecisionPrompt;
  chapters: Chapter[];
  subjects: { id: string; name: string }[];
  justSwitched: boolean;
  onContinue: () => void;
  onSwitchToMemorize: () => void;
  onRestore: () => void;
  onShowStudyPolicy: () => void;
}) {
  const chapter = chapters.find((c) => c.id === prompt.chapterId);
  const subtopic = prompt.subtopicId
    ? chapter?.subtopics?.find((s) => s.id === prompt.subtopicId) ?? null
    : null;
  const subject = subjects.find((s) => s.id === prompt.subjectId);
  if (!chapter || !subject) return null;

  const itemName = subtopic ? `${chapter.name}・${subtopic.name}` : chapter.name;
  const switchLabel = subject.name === "英語" ? "訳文暗記に切り替える" : "覚えるモードにする";

  if (justSwitched) {
    return (
      <li className="forecast-decision-card forecast-decision-card-confirmed">
        <p className="forecast-decision-message">
          {itemName}を暗記モードに切り替えました。明日から「今日やること」には出ません。自分のペースで解き方を覚えて復習してください。
        </p>
        <button type="button" className="secondary" onClick={onRestore}>
          元に戻す
        </button>
      </li>
    );
  }

  return (
    <li className="forecast-decision-card">
      <p className="forecast-decision-message">
        {itemName}、このままだと他の章が終わらなそうです。
      </p>
      <p className="forecast-decision-reason muted small">
        3日続けて「このペースだと間に合わなそう」と出ています。
      </p>
      <div className="forecast-decision-actions">
        <button type="button" className="primary" onClick={onContinue}>
          このまま続ける
        </button>
        <button type="button" className="secondary" onClick={onSwitchToMemorize}>
          {switchLabel}
        </button>
      </div>
      <button type="button" className="link-btn forecast-decision-policy-link" onClick={onShowStudyPolicy}>
        📖 勉強方針を見る
      </button>
    </li>
  );
}
