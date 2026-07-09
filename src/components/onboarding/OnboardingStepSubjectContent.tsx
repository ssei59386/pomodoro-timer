import type { Dispatch, SetStateAction } from "react";
import { AchievementLevelPicker } from "../AchievementLevelPicker";
import { ChapterCurriculumSuggest } from "../ChapterCurriculumSuggest";
import { CurriculumSuggest } from "../CurriculumSuggest";
import { CurriculumSubtopicPicker } from "../CurriculumSubtopicPicker";
import { SUBJECT_TEMPLATES } from "../../data/subjectTemplates";
import { studyLevelsForTrack } from "../../data/studyPolicy";
import {
  makeBlankChapter,
  makeBlankSubtopic,
  makeBlankVocabRange,
  type DraftChapter,
  type DraftSubject,
  type DraftSubtopic,
  type DraftVocabRange,
} from "./onboardingTypes";

interface Props {
  subject: DraftSubject;
  /** 全教科ぶんの下書き配列。この教科ぶんは内部でフィルタして描画する（暗記範囲の「対応する章」選択で
   * 同じ教科の章一覧が必要なため、フィルタ済みの配列だけでなく更新用の setState もそのまま受け取る） */
  chapters: DraftChapter[];
  setChapters: Dispatch<SetStateAction<DraftChapter[]>>;
  vocabRanges: DraftVocabRange[];
  setVocabRanges: Dispatch<SetStateAction<DraftVocabRange[]>>;
}

/**
 * 教科ごとの内容入力ステップ（章・小項目・暗記範囲）。教科はステップで固定されるため、
 * 章・暗記範囲それぞれの「教科を選ぶドロップダウン」は出さない（docs/feature-onboarding-wizard.md）。
 * capability（章を持てるか・暗記範囲を持てるか）は教科名ではなく template（段階5）から判定する。
 */
export function OnboardingStepSubjectContent({
  subject,
  chapters,
  setChapters,
  vocabRanges,
  setVocabRanges,
}: Props) {
  const template = SUBJECT_TEMPLATES[subject.templateKey];
  const isChapterCapable = template.chapterCapable;
  const isVocabCapable = template.vocabCapable;
  const curriculumSubject = template.curriculumSubject;
  const achievementLevels = template.studyPolicy.levels;
  const subjectChapters = chapters.filter((c) => c.subjectInstanceId === subject.instanceId);
  const subjectVocabRanges = vocabRanges.filter((v) => v.subjectInstanceId === subject.instanceId);
  const namedSubjectChapters = subjectChapters.filter((c) => c.name.trim() !== "");

  const addChapter = () => {
    setChapters((prev) => [...prev, makeBlankChapter(subject.instanceId)]);
  };

  const updateChapter = (key: string, patch: Partial<DraftChapter>) => {
    setChapters((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const removeChapter = (key: string) => {
    setChapters((prev) => prev.filter((c) => c.key !== key));
  };

  const addSubtopic = (chapterKey: string) => {
    setChapters((prev) =>
      prev.map((c) =>
        c.key === chapterKey ? { ...c, subtopics: [...c.subtopics, makeBlankSubtopic()] } : c,
      ),
    );
  };

  const updateSubtopic = (chapterKey: string, subtopicKey: string, patch: Partial<DraftSubtopic>) => {
    setChapters((prev) =>
      prev.map((c) =>
        c.key === chapterKey
          ? { ...c, subtopics: c.subtopics.map((st) => (st.key === subtopicKey ? { ...st, ...patch } : st)) }
          : c,
      ),
    );
  };

  const removeSubtopic = (chapterKey: string, subtopicKey: string) => {
    setChapters((prev) =>
      prev.map((c) =>
        c.key === chapterKey ? { ...c, subtopics: c.subtopics.filter((st) => st.key !== subtopicKey) } : c,
      ),
    );
  };

  const addVocabRange = () => {
    setVocabRanges((prev) => [...prev, makeBlankVocabRange(subject.instanceId)]);
  };

  const updateVocabRange = (key: string, patch: Partial<DraftVocabRange>) => {
    setVocabRanges((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  };

  const removeVocabRange = (key: string) => {
    setVocabRanges((prev) => prev.filter((v) => v.key !== key));
  };

  return (
    <>
      {isChapterCapable && (
        <section className="card">
          <h2>章の登録</h2>
          <p className="muted">章ごとに「名前・今の理解度」を入れてください。</p>

          {subjectChapters.map((c) => (
            <div key={c.key} className="chapter-draft">
              <div className="chapter-draft-row">
                <div className="chapter-name-field">
                  <input
                    type="text"
                    placeholder="章名（例：二次関数）"
                    value={c.name}
                    onChange={(e) => updateChapter(c.key, { name: e.target.value })}
                  />
                  {curriculumSubject && (
                    <ChapterCurriculumSuggest query={c.name} subject={curriculumSubject} />
                  )}
                </div>
                <button type="button" className="icon-btn" aria-label="削除" onClick={() => removeChapter(c.key)}>
                  ✕
                </button>
              </div>
              <div className="subtopic-block">
                <div className="subtopic-block-head">
                  <span className="muted small">小項目（任意・プリントの見出しなど2〜4個）</span>
                  <div className="subtopic-block-actions">
                    {curriculumSubject && (
                      <CurriculumSubtopicPicker
                        chapterName={c.name}
                        subject={curriculumSubject}
                        onAdd={(candidates) => {
                          setChapters((prev) =>
                            prev.map((chapter) =>
                              chapter.key === c.key
                                ? {
                                    ...chapter,
                                    subtopics: [
                                      ...chapter.subtopics,
                                      ...candidates.map((cand) => ({
                                        ...makeBlankSubtopic(),
                                        name: cand.name,
                                        difficultyLevel: cand.difficultyLevel,
                                      })),
                                    ],
                                  }
                                : chapter,
                            ),
                          );
                        }}
                      />
                    )}
                    <button type="button" className="link-btn" onClick={() => addSubtopic(c.key)}>
                      ＋ 小項目を追加
                    </button>
                  </div>
                </div>
                {curriculumSubject && (
                  <p className="muted small">
                    小項目名を入力すると、カリキュラム参考データとの一致で難易度が自動入力されます（手動で上書き可）。
                  </p>
                )}
                {c.subtopics.map((st) => (
                  <div key={st.key} className="subtopic-row">
                    <div className="subtopic-name-field">
                      <input
                        type="text"
                        className="grow"
                        placeholder="小項目名（例：頂点）"
                        value={st.name}
                        onChange={(e) => updateSubtopic(c.key, st.key, { name: e.target.value })}
                      />
                      {curriculumSubject && (
                        <CurriculumSuggest
                          query={st.name}
                          subject={curriculumSubject}
                          onSelect={(result) => updateSubtopic(c.key, st.key, { difficultyLevel: result.difficultyLevel })}
                        />
                      )}
                    </div>
                    {st.difficultyLevel !== null && (
                      <span className="muted small">難易度（カリキュラム参考・5段階）：{st.difficultyLevel}</span>
                    )}
                    {template.trackCapable && (
                      <label className="field inline">
                        <span className="muted small">トラック（任意・記録時の達成段階の言葉が変わります）</span>
                        <select
                          value={st.track ?? ""}
                          onChange={(e) =>
                            updateSubtopic(c.key, st.key, {
                              track: e.target.value === "" ? null : (e.target.value as "grammar" | "reading"),
                            })
                          }
                        >
                          <option value="">区別しない</option>
                          <option value="grammar">文法</option>
                          <option value="reading">読解</option>
                        </select>
                      </label>
                    )}
                    <div className="self-report-block">
                      <span className="self-report-label">今の理解度</span>
                      <AchievementLevelPicker
                        value={st.achievedLevel}
                        onChange={(v) => updateSubtopic(c.key, st.key, { achievedLevel: v as 1 | 2 | 3 | 4 | 5 })}
                        levels={studyLevelsForTrack(achievementLevels, st.track ?? undefined)}
                      />
                    </div>
                    <label className="field inline">
                      <span className="muted small">基礎問題数</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="教科書の例題+問題集の基礎問題"
                        value={st.basicProblems ?? ""}
                        onChange={(e) =>
                          updateSubtopic(c.key, st.key, {
                            basicProblems: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                          })
                        }
                      />
                      <span className="muted small">任意・教科書の例題＋問題集の基礎レベル問題の合計</span>
                    </label>
                    <label className="subtopic-hint-row">
                      <input
                        type="checkbox"
                        checked={st.teacherHinted}
                        onChange={(e) => updateSubtopic(c.key, st.key, { teacherHinted: e.target.checked })}
                      />
                      <span className="muted small">先生からテストのヒントがあった</span>
                    </label>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="小項目を削除"
                      onClick={() => removeSubtopic(c.key, st.key)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {c.subtopics.length === 0 && (
                <div className="self-report-block">
                  <span className="self-report-label">今の理解度</span>
                  <AchievementLevelPicker
                    value={c.achievedLevel}
                    onChange={(v) => updateChapter(c.key, { achievedLevel: v as 1 | 2 | 3 | 4 | 5 })}
                    levels={achievementLevels}
                  />
                </div>
              )}
            </div>
          ))}

          <button type="button" className="secondary" onClick={addChapter}>
            ＋ 章を追加
          </button>
        </section>
      )}

      {isVocabCapable && (
        <section className="card">
          <h2>暗記範囲の登録</h2>
          <p className="muted">
            暗記範囲（開始番号〜終了番号）を登録すると、20語ずつの「枠」単位で新規学習・復習の進み具合を自動で管理します（例：ターゲット1900 / 一問一答 歴史 / 漢字ドリル）。意味・読み方などの中身は入力不要です。
          </p>

          {subjectVocabRanges.map((v) => (
            <div key={v.key} className="subtopic-row">
              <div className="chapter-draft-row">
                <input
                  type="text"
                  className="grow"
                  placeholder="ラベル（例：ターゲット1900）"
                  value={v.label}
                  onChange={(e) => updateVocabRange(v.key, { label: e.target.value })}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="暗記範囲を削除"
                  onClick={() => removeVocabRange(v.key)}
                >
                  ✕
                </button>
              </div>
              <div className="subtopic-problem-row">
                <label className="field inline">
                  <span className="muted small">開始番号</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="例：371"
                    value={v.startNumber ?? ""}
                    onChange={(e) =>
                      updateVocabRange(v.key, {
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
                    value={v.endNumber ?? ""}
                    onChange={(e) =>
                      updateVocabRange(v.key, {
                        endNumber: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </label>
              </div>
              {template.chapterCapable && (
                <label className="field">
                  <span className="muted small">対応する章（任意・教科書レッスンに紐づける場合のみ）</span>
                  <select
                    value={v.chapterKey ?? ""}
                    onChange={(e) => updateVocabRange(v.key, { chapterKey: e.target.value === "" ? null : e.target.value })}
                  >
                    <option value="">なし</option>
                    {namedSubjectChapters.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}

          <button type="button" className="secondary" onClick={addVocabRange}>
            ＋ 暗記範囲を追加
          </button>
        </section>
      )}

      <p className="muted small">
        {subject.name}について、章か暗記範囲のどちらか一方は登録してください（両方登録してもかまいません）。
      </p>
    </>
  );
}
