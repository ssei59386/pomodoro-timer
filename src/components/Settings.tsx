import { useState } from "react";
import { useStore, uid } from "../store";
import { DEFAULT_TARGET_UNDERSTANDING, isPastDate } from "../logic";
import type { Chapter } from "../types";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";
import { CalendarOverrides } from "./CalendarOverrides";

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
    resetAll,
  } = useStore();

  const [confirmingReset, setConfirmingReset] = useState(false);

  const addSubtopic = (chapter: Chapter) => {
    updateChapter({
      ...chapter,
      subtopics: [...(chapter.subtopics ?? []), { id: uid(), name: "" }],
    });
  };

  const updateSubtopicName = (chapter: Chapter, subtopicId: string, name: string) => {
    updateChapter({
      ...chapter,
      subtopics: (chapter.subtopics ?? []).map((st) =>
        st.id === subtopicId ? { ...st, name } : st,
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
                  <input
                    type="text"
                    className="grow"
                    value={c.name}
                    onChange={(e) => updateChapter({ ...c, name: e.target.value })}
                  />
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
                    <button type="button" className="link-btn" onClick={() => addSubtopic(c)}>
                      ＋ 小項目を追加
                    </button>
                  </div>
                  {(c.subtopics ?? []).map((st) => (
                    <div key={st.id} className="subtopic-row">
                      <input
                        type="text"
                        className="grow"
                        placeholder="小項目名（例：頂点）"
                        value={st.name}
                        onChange={(e) => updateSubtopicName(c, st.id, e.target.value)}
                      />
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
