import { useEffect, useState } from "react";
import { useStore } from "../store";
import { computeStreak, toISODate } from "../logic";
import type { StudySession } from "../types";
import { resolveTemplate } from "../data/subjectTemplates";
import { studyLevelsForTrack } from "../data/studyPolicy";
import { AchievementLevelPicker } from "./AchievementLevelPicker";

// 仕様書 §7.3 セッション記録（段階4：達成段階ベースの記録に置き換え）
// 対象の章を選び、かけた時間・達成段階（教科ごとのラダー、1〜5）を入力 → 保存で理解度を更新する。
// 理解度は段階/5 を直接セットする（平滑化なし。docs/feature-study-policy.md 決定事項 D3）。

// select の「章全体として記録」オプション用の値。空文字列は未選択プレースホルダーに使うため、
// 実際の選択肢としては別の値を割り当て、onChange で subtopicId の空文字列に正規化する。
const WHOLE_CHAPTER_VALUE = "__whole_chapter__";

/** 現在の理解度（0.0〜1.0）から達成段階の初期選択を逆算する。未設定なら中間の3。 */
function computeInitialAchievedLevel(understanding: number | undefined | null): 1 | 2 | 3 | 4 | 5 {
  if (understanding === undefined || understanding === null) return 3;
  const level = Math.min(5, Math.max(1, Math.round(understanding * 5)));
  return level as 1 | 2 | 3 | 4 | 5;
}

export function SessionRecord({
  preselectChapterId,
  preselectSubtopicId,
  onDone,
  onGoSettings,
}: {
  preselectChapterId: string | null;
  preselectSubtopicId: string | null;
  onDone: () => void;
  onGoSettings: () => void;
}) {
  const { data, recordSession } = useStore();

  const [chapterId, setChapterId] = useState<string>(
    preselectChapterId ?? data.chapters[0]?.id ?? "",
  );
  // 空文字列 = 未選択 or 「章全体として記録」（小項目を指定しない）。
  // select の初期値は空文字列だが、先頭に選択不可のプレースホルダーを置いて未選択を明示するため、
  // 「章全体として記録」オプション自体は別の値（WHOLE_CHAPTER_VALUE）を持たせ、
  // onChange で空文字列に正規化する。
  const [subtopicId, setSubtopicId] = useState<string>("");
  // 入力中に空文字列を許容するため number | "" 型にする（保存時に最低1分へ補正）。
  // 空にした瞬間に Number("") が 0 になり Math.max(1, 0) で強制的に 1 へ戻されると、
  // 実機で「1が消せず145のような値になってしまう」不具合が起きるため。
  const [minutes, setMinutes] = useState<number | "">(45);
  // 達成段階（1〜5）。初期値は対象章/小項目の現在の理解度から逆算する（下の effect 参照）。
  const [achievedLevel, setAchievedLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  // 未入力を許容する任意項目のため null 初期値（minutes 等の必須数値入力とは異なる）
  const [problemsCompleted, setProblemsCompleted] = useState<number | null>(null);
  // 小項目を選んだときだけ使う基礎問題の内訳（章全体記録時の problemsCompleted とは別軸）。
  // 発展問題は 2026-07-09 に廃止（達成段階ラダーの段階5と二重管理のため）。
  const [basicProblemsCompleted, setBasicProblemsCompleted] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  // 連続記録ストリークの保存直後表示用。recordSession は setState 非同期のため、
  // この時点の data.sessions にはまだ今回保存した1件が反映されていない。
  // computeStreak は date しか見ないので、最小限のオブジェクトを1件足してから計算する。
  const [savedStreak, setSavedStreak] = useState<number | null>(null);

  // preselectChapterId と preselectSubtopicId は同じ「記録画面へ遷移する」操作から
  // 同時に渡ってくるため、1つの effect にまとめて同時にセットする。
  // 章の effect → 小項目リセットの effect、と2つに分けてしまうと、後者が発火して
  // preselect した小項目IDを直後に "" へ戻してしまう競合が起きるため、あえて分離しない。
  useEffect(() => {
    if (preselectChapterId) {
      setChapterId(preselectChapterId);
      setSubtopicId(preselectSubtopicId ?? "");
    }
  }, [preselectChapterId, preselectSubtopicId]);

  // 小項目の選択が変わるたびに、他の章・小項目の入力値が残らないようにリセットする
  // （章全体用の problemsCompleted も対象 — 小項目に切り替えて戻った際に古い値が復活しないように）
  useEffect(() => {
    setBasicProblemsCompleted(null);
    setProblemsCompleted(null);
  }, [subtopicId]);

  // 章/小項目を切り替えるたびに、達成段階の初期選択もその対象の現在理解度から追従させる。
  // chapterId 単独の変更（小項目を持たない章→持たない章、等）でも subtopicId が実質的に
  // 変化しない場合があるため、両方を依存にして必ず再計算する（data.chapters は意図的に
  // 依存から外す — 保存後の理解度更新でこの effect が再発火し、選んだばかりの段階が
  // 理解度から逆算した値に巻き戻ってしまうのを防ぐため）。
  useEffect(() => {
    const chapter = data.chapters.find((c) => c.id === chapterId);
    const subtopic = subtopicId ? chapter?.subtopics?.find((st) => st.id === subtopicId) : undefined;
    const understanding = subtopicId ? subtopic?.understanding : chapter?.understanding;
    setAchievedLevel(computeInitialAchievedLevel(understanding));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, subtopicId]);

  const subjectName = (subjectId: string) =>
    data.subjects.find((s) => s.id === subjectId)?.name ?? "";

  const selectedChapter = data.chapters.find((c) => c.id === chapterId);
  const subtopics = selectedChapter?.subtopics ?? [];
  const selectedSubject = selectedChapter
    ? data.subjects.find((s) => s.id === selectedChapter.subjectId)
    : undefined;
  const selectedSubtopic = subtopicId
    ? subtopics.find((st) => st.id === subtopicId)
    : undefined;
  // 英語の文法/読解トラックが設定された小項目なら、そのトラック専用ラダーに切り替える（段階7）。
  // 章全体記録・トラック未設定の小項目・他教科では親教科の基本ラダーをそのまま使う。
  const baseAchievementLevels = selectedSubject ? resolveTemplate(selectedSubject).studyPolicy.levels : [];
  const achievementLevels = studyLevelsForTrack(baseAchievementLevels, selectedSubtopic?.track);

  const handleSave = () => {
    if (!chapterId) return;
    const today = new Date();
    const todayISO = toISODate(today);
    recordSession({
      chapterId,
      subtopicId: subtopicId || undefined,
      date: todayISO,
      minutes: Math.max(1, Number(minutes) || 0),
      achievedLevel,
      problemsCompleted: subtopicId ? undefined : problemsCompleted ?? undefined,
      basicProblemsCompleted: subtopicId ? basicProblemsCompleted ?? undefined : undefined,
    });
    setSavedStreak(computeStreak([...data.sessions, { date: todayISO } as StudySession], today));
    setSaved(true);
    // 軽いフィードバックの後にダッシュボードへ
    setTimeout(onDone, 700);
  };

  if (data.chapters.length === 0) {
    return (
      <div className="screen">
        <h2>セッション記録</h2>
        <div className="empty">
          <p className="muted">先に章を登録してください（設定から追加できます）。</p>
          <button className="secondary" onClick={onGoSettings}>
            設定で章を登録する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>セッション記録</h2>
        <p className="muted">勉強した内容を記録すると、その章の理解度が達成段階に応じて更新されます。</p>
      </div>

      <label className="field">
        <span>勉強した章</span>
        <select
          value={chapterId}
          onChange={(e) => {
            setChapterId(e.target.value);
            setSubtopicId("");
          }}
        >
          {data.chapters.map((c) => (
            <option key={c.id} value={c.id}>
              [{subjectName(c.subjectId)}] {c.name}
            </option>
          ))}
        </select>
      </label>

      {subtopics.length > 0 && (
        <label className="field">
          <span>小項目</span>
          <select
            value={subtopicId}
            onChange={(e) =>
              setSubtopicId(e.target.value === WHOLE_CHAPTER_VALUE ? "" : e.target.value)
            }
          >
            <option value="" disabled hidden>
              小項目を選んでください（章全体で記録する場合は「章全体として記録」を選択）
            </option>
            {subtopics.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
                {st.track === "grammar" ? "（文法）" : st.track === "reading" ? "（読解）" : ""}
              </option>
            ))}
            <option value={WHOLE_CHAPTER_VALUE}>章全体として記録</option>
          </select>
        </label>
      )}

      <label className="field">
        <span>かけた時間（分）</span>
        <input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value === "" ? "" : Number(e.target.value))}
          onBlur={() => setMinutes((m) => (m === "" || m < 1 ? 1 : m))}
        />
      </label>

      <div className="self-report-block">
        <span className="self-report-label">今どこまで達成できた？</span>
        <AchievementLevelPicker
          value={achievedLevel}
          onChange={(n) => setAchievedLevel(n as 1 | 2 | 3 | 4 | 5)}
          levels={achievementLevels}
        />
      </div>

      {subtopicId ? (
        <div className="subtopic-problem-row-wrap">
          <p className="muted small">
            わかる範囲でOKです（空欄のままでも保存できます）
          </p>
          <label className="field">
            <span>基礎で解いた問題数</span>
            <input
              type="number"
              min={0}
              value={basicProblemsCompleted ?? ""}
              onChange={(e) =>
                setBasicProblemsCompleted(
                  e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                )
              }
            />
            <span className="muted small">任意</span>
          </label>
        </div>
      ) : (
        <label className="field">
          <span>解いた問題数</span>
          <input
            type="number"
            min={0}
            value={problemsCompleted ?? ""}
            onChange={(e) =>
              setProblemsCompleted(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))
            }
          />
          <span className="muted small">任意</span>
        </label>
      )}

      <button className="primary big" onClick={handleSave} disabled={saved}>
        {saved ? "保存しました ✓" : "記録して理解度を更新"}
      </button>
      {/* 煽らないトーンを保つため、3日未満では何も出さない（CEOプロダクト判断）。 */}
      {saved && savedStreak !== null && savedStreak >= 3 && (
        <p className="muted small">{savedStreak}日連続で記録できています</p>
      )}
    </div>
  );
}
