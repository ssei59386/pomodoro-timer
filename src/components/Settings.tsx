import { useState } from "react";
import { useStore, uid } from "../store";
import { DEFAULT_TARGET_UNDERSTANDING, isPastDate, validateVocabRangeDraft } from "../logic";
import type { Chapter, ChapterSubtopic, Subject } from "../types";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";
import { CalendarOverrides } from "./CalendarOverrides";
import { CurriculumSuggest } from "./CurriculumSuggest";
import { ChapterCurriculumSuggest } from "./ChapterCurriculumSuggest";
import { CurriculumSubtopicPicker } from "./CurriculumSubtopicPicker";

/**
 * 単語帳の範囲登録フォームの下書き（Settings は既に確定済みの Subject/Chapter を持つため、
 * Onboarding のような draft key 経由の間接参照は不要で、subjectId/chapterId を直接扱う）。
 */
interface VocabRangeDraft {
  label: string;
  startNumber: number | null;
  endNumber: number | null;
  chapterId: string | null;
}

const EMPTY_VOCAB_DRAFT: VocabRangeDraft = {
  label: "",
  startNumber: null,
  endNumber: null,
  chapterId: null,
};

// 仕様書 §7.5 設定
// テスト日・勉強可能時間・章/配点の編集、データのリセット。
export function Settings() {
  const {
    data,
    updateSubject,
    updateChapter,
    addChapter,
    removeChapter,
    setAvailability,
    addVocabRange,
    removeVocabRange,
    resetAll,
  } = useStore();

  const [confirmingReset, setConfirmingReset] = useState(false);
  // 単語帳登録フォームの下書き・エラーは教科ごとに独立させる（教科card内で完結させるため）
  const [vocabDraftBySubject, setVocabDraftBySubject] = useState<Record<string, VocabRangeDraft>>({});
  const [vocabErrorBySubject, setVocabErrorBySubject] = useState<Record<string, string | null>>({});

  const getVocabDraft = (subjectId: string): VocabRangeDraft =>
    vocabDraftBySubject[subjectId] ?? EMPTY_VOCAB_DRAFT;

  const updateVocabDraft = (subjectId: string, patch: Partial<VocabRangeDraft>) => {
    setVocabDraftBySubject((prev) => ({
      ...prev,
      [subjectId]: { ...getVocabDraft(subjectId), ...patch },
    }));
  };

  const submitVocabDraft = (subject: Subject) => {
    const draft = getVocabDraft(subject.id);
    const validationError = validateVocabRangeDraft(draft);
    if (validationError) {
      setVocabErrorBySubject((prev) => ({ ...prev, [subject.id]: validationError }));
      return;
    }
    addVocabRange({
      subjectId: subject.id,
      label: draft.label.trim(),
      chapterId: draft.chapterId ?? undefined,
      startNumber: draft.startNumber!,
      endNumber: draft.endNumber!,
    });
    setVocabDraftBySubject((prev) => ({ ...prev, [subject.id]: EMPTY_VOCAB_DRAFT }));
    setVocabErrorBySubject((prev) => ({ ...prev, [subject.id]: null }));
  };

  const addSubtopic = (chapter: Chapter) => {
    updateChapter({
      ...chapter,
      subtopics: [...(chapter.subtopics ?? []), { id: uid(), name: "" }],
    });
  };

  const updateSubtopicField = (
    chapter: Chapter,
    subtopicId: string,
    patch: Partial<ChapterSubtopic>,
  ) => {
    updateChapter({
      ...chapter,
      subtopics: (chapter.subtopics ?? []).map((st) =>
        st.id === subtopicId ? { ...st, ...patch } : st,
      ),
    });
  };

  const removeSubtopic = (chapter: Chapter, subtopicId: string) => {
    updateChapter({
      ...chapter,
      subtopics: (chapter.subtopics ?? []).filter((st) => st.id !== subtopicId),
    });
  };

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>設定</h2>
      </div>

      <section className="card">
        <h3>勉強できる時間</h3>
        <p className="muted">曜日ごとに勉強できる時間帯を編集できます。</p>
        <WeeklyScheduleEditor
          value={data.availability.weeklySchedule}
          onChange={(weeklySchedule) =>
            setAvailability({ ...data.availability, weeklySchedule })
          }
        />
      </section>

      <section className="card">
        <h3>特別な予定（カレンダー）</h3>
        <p className="muted">
          旅行や用事などで曜日の設定と違う日だけ、日付を選んで個別に空き時間を変更できます。
        </p>
        <CalendarOverrides
          availability={data.availability}
          onChange={(dateOverrides) =>
            setAvailability({ ...data.availability, dateOverrides })
          }
        />
      </section>

      {data.subjects.map((subject) => {
        const chapters = data.chapters.filter((c) => c.subjectId === subject.id);
        return (
          <section key={subject.id} className="card">
            <h3>{subject.name}</h3>
            <label className="field">
              <span>テスト日</span>
              <input
                type="date"
                value={subject.testDate}
                onChange={(e) => updateSubject({ ...subject, testDate: e.target.value })}
              />
            </label>
            {subject.testDate && isPastDate(subject.testDate, new Date()) && (
              <p className="error-inline">テスト日が過去の日付になっています。</p>
            )}

            <h4 className="sub-head">章 / 配点</h4>
            {chapters.map((c) => (
              <div key={c.id}>
                <div className="settings-chapter-row">
                  <div className="chapter-name-field">
                    <input
                      type="text"
                      className="grow"
                      value={c.name}
                      onChange={(e) => updateChapter({ ...c, name: e.target.value })}
                    />
                    {(subject.name === "数学" || subject.name === "理科") && (
                      <ChapterCurriculumSuggest query={c.name} subject={subject.name} />
                    )}
                  </div>
                  <input
                    type="number"
                    className="narrow"
                    min={0}
                    value={c.pointWeight}
                    onChange={(e) =>
                      updateChapter({ ...c, pointWeight: Math.max(0, Number(e.target.value)) })
                    }
                    aria-label="配点"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="章を削除"
                    onClick={() => removeChapter(c.id)}
                  >
                    ✕
                  </button>
                </div>
                <div className="subtopic-block">
                  <div className="subtopic-block-head">
                    <span className="muted small">
                      小項目（任意）— 学習範囲を細かく分けて管理したい場合に使えます
                    </span>
                    <div className="subtopic-block-actions">
                      {(subject.name === "数学" || subject.name === "理科") && (
                        <CurriculumSubtopicPicker
                          chapterName={c.name}
                          subject={subject.name}
                          onAdd={(candidates) => {
                            updateChapter({
                              ...c,
                              subtopics: [
                                ...(c.subtopics ?? []),
                                ...candidates.map((cand) => ({
                                  id: uid(),
                                  name: cand.name,
                                  difficultyLevel: cand.difficultyLevel,
                                })),
                              ],
                            });
                          }}
                        />
                      )}
                      <button type="button" className="link-btn" onClick={() => addSubtopic(c)}>
                        ＋ 小項目を追加
                      </button>
                    </div>
                  </div>
                  {(subject.name === "数学" || subject.name === "理科") && (
                    <p className="muted small">
                      小項目名を入力すると、カリキュラム参考データとの一致で難易度が自動入力されます（手動で上書き可）。
                    </p>
                  )}
                  {(c.subtopics ?? []).map((st) => (
                    <div key={st.id} className="subtopic-row">
                      <div className="subtopic-name-field">
                        <input
                          type="text"
                          className="grow"
                          placeholder="小項目名（例：頂点）"
                          value={st.name}
                          onChange={(e) =>
                            updateSubtopicField(c, st.id, { name: e.target.value })
                          }
                        />
                        {(subject.name === "数学" || subject.name === "理科") && (
                          <CurriculumSuggest
                            query={st.name}
                            subject={subject.name}
                            onSelect={(result) =>
                              updateSubtopicField(c, st.id, {
                                difficultyLevel: result.difficultyLevel,
                              })
                            }
                          />
                        )}
                      </div>
                      {st.difficultyLevel !== undefined && (
                        <span className="muted small">
                          難易度（カリキュラム参考・5段階）：{st.difficultyLevel}
                        </span>
                      )}
                      <div className="subtopic-problem-row">
                        <label className="field inline">
                          <span className="muted small">基礎問題数</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="教科書の例題+問題集の基礎問題"
                            value={st.basicProblems ?? ""}
                            onChange={(e) =>
                              updateSubtopicField(c, st.id, {
                                basicProblems:
                                  e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)),
                              })
                            }
                          />
                          <span className="muted small">
                            任意・教科書の例題＋問題集の基礎レベル問題の合計
                          </span>
                        </label>
                        <label className="field inline">
                          <span className="muted small">発展問題数</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="教科書+問題集の発展問題"
                            value={st.advancedProblems ?? ""}
                            onChange={(e) =>
                              updateSubtopicField(c, st.id, {
                                advancedProblems:
                                  e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)),
                              })
                            }
                          />
                          <span className="muted small">
                            任意・教科書＋問題集の発展レベル問題の合計
                          </span>
                        </label>
                      </div>
                      <label className="subtopic-hint-row">
                        <input
                          type="checkbox"
                          checked={st.teacherHinted ?? false}
                          onChange={(e) =>
                            updateSubtopicField(c, st.id, { teacherHinted: e.target.checked })
                          }
                        />
                        <span className="muted small">先生からテストのヒントがあった</span>
                      </label>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="小項目を削除"
                        onClick={() => removeSubtopic(c, st.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="secondary"
              onClick={() =>
                addChapter({
                  subjectId: subject.id,
                  name: "新しい章",
                  pointWeight: 20,
                  understanding: 0.4,
                  targetUnderstanding: DEFAULT_TARGET_UNDERSTANDING,
                  lastStudiedDate: null,
                })
              }
            >
              ＋ 章を追加
            </button>

            <h4 className="sub-head">単語帳</h4>
            <p className="muted small">
              単語帳（例：ターゲット1900）の範囲を登録すると、番号ごとに新規学習・復習の進み具合を自動で管理します。単語の意味は入力不要です。
            </p>
            {data.vocabRanges
              .filter((r) => r.subjectId === subject.id)
              .map((range) => (
                <div key={range.id} className="settings-chapter-row">
                  <span className="grow">
                    {range.label}（{range.startNumber}〜{range.endNumber}番）
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="単語帳の範囲を削除"
                    onClick={() => removeVocabRange(range.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            <div className="subtopic-row vocab-range-draft">
              <input
                type="text"
                className="grow"
                placeholder="ラベル（例：ターゲット1900）"
                value={getVocabDraft(subject.id).label}
                onChange={(e) => updateVocabDraft(subject.id, { label: e.target.value })}
              />
              <div className="subtopic-problem-row">
                <label className="field inline">
                  <span className="muted small">開始番号</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="例：371"
                    value={getVocabDraft(subject.id).startNumber ?? ""}
                    onChange={(e) =>
                      updateVocabDraft(subject.id, {
                        startNumber: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </label>
                <label className="field inline">
                  <span className="muted small">終了番号</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="例：670"
                    value={getVocabDraft(subject.id).endNumber ?? ""}
                    onChange={(e) =>
                      updateVocabDraft(subject.id, {
                        endNumber: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </label>
              </div>
              <label className="field">
                <span className="muted small">対応する章（任意・教科書レッスンに紐づける場合のみ）</span>
                <select
                  value={getVocabDraft(subject.id).chapterId ?? ""}
                  onChange={(e) =>
                    updateVocabDraft(subject.id, {
                      chapterId: e.target.value === "" ? null : e.target.value,
                    })
                  }
                >
                  <option value="">なし（単語帳のみ）</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {vocabErrorBySubject[subject.id] && (
                <p className="error-inline">{vocabErrorBySubject[subject.id]}</p>
              )}
              <button type="button" className="secondary" onClick={() => submitVocabDraft(subject)}>
                ＋ 単語帳の範囲を追加
              </button>
            </div>
          </section>
        );
      })}

      <section className="card danger-zone">
        <h3>データのリセット</h3>
        <p className="muted">すべての教科・章・記録を削除して最初からやり直します。</p>
        {confirmingReset ? (
          <div className="confirm-row">
            <button className="danger" onClick={resetAll}>
              本当に削除する
            </button>
            <button className="secondary" onClick={() => setConfirmingReset(false)}>
              やめる
            </button>
          </div>
        ) : (
          <button className="danger-outline" onClick={() => setConfirmingReset(true)}>
            データをリセット
          </button>
        )}
      </section>

      <p className="muted footer-note">
        データはこの端末内（ブラウザ）にのみ保存されます。サーバー送信・ログインはありません。
      </p>
    </div>
  );
}
