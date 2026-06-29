import { useState } from "react";
import { useStore } from "../store";
import { DEFAULT_TARGET_UNDERSTANDING } from "../logic";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";

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
          onChange={(weeklySchedule) => setAvailability({ weeklySchedule })}
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

            <h4 className="sub-head">章 / 配点</h4>
            {chapters.map((c) => (
              <div key={c.id} className="settings-chapter-row">
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
