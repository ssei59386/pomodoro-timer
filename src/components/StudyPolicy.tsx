import { useState } from "react";
import { useStore } from "../store";
import { REGRET_PREVENTION_TRIGGER_POINTS } from "../data/studyPolicy";
import { resolveTemplate, type SubjectTemplateKey } from "../data/subjectTemplates";

// 国語の勉強方針ラダーは未整備（docs/feature-study-policy.md で後回しと明記）。
// subjectTemplates.ts の japanese.studyPolicy は型を満たすためだけの社会ラダー流用の
// プレースホルダーなので、この画面では意図的に対象外のままにする（既存の挙動を維持）。
const STUDY_POLICY_EXCLUDED_TEMPLATE_KEYS: SubjectTemplateKey[] = ["japanese"];

// 「勉強方針」画面（docs/feature-study-policy.md Phase 1）。理解度の各段階が何を意味していて
// 次に何をすればいいかを教科ごとに示す、純粋な表示専用画面（ロジックは src/data/studyPolicy.ts）。
// タブは増やさず、Dashboard/Home から開く一時サブ画面（App.tsx の VocabQuiz と同じパターン）。
// アコーディオンは <details> ではなく useState+button で実装する（CLAUDE.md 既知の罠：
// Playwright の合成クリックがネイティブ <details> に反応しないことがある）。
export function StudyPolicy({ onDone }: { onDone: () => void }) {
  const { data } = useStore();
  // 生徒が実際に登録している教科のラダーだけ表示する（未登録の教科まで並べると、
  // 触ったことのない教科の説明が混ざって紛らわしいため。ux-reviewer指摘）。
  // 教科は複数登録できる（段階4）ため、教科名ではなく Subject インスタンスごとにカードを出す
  // （数学I/数学Aのように同テンプレートの教科が複数あっても、それぞれ別カードで自然に並ぶ）。
  const visibleSubjects = data.subjects.filter(
    (s) => !STUDY_POLICY_EXCLUDED_TEMPLATE_KEYS.includes(resolveTemplate(s).key),
  );

  // 最初の教科だけ開いた状態にしておく（全部畳んだ状態から始めると、何があるか一目で
  // 伝わらないため）。
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(
    visibleSubjects[0]?.id ?? null,
  );

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>勉強方針</h2>
        <p className="muted">
          理解度の各段階が何を意味していて、次に何をすればいいかをまとめています。
        </p>
      </div>

      <section className="card study-policy-trigger-card">
        <h3>後悔防止の仕組みについて</h3>
        <ul className="study-policy-trigger-points">
          {REGRET_PREVENTION_TRIGGER_POINTS.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      </section>

      {visibleSubjects.map((subject) => {
        const policy = resolveTemplate(subject).studyPolicy;
        const isOpen = openSubjectId === subject.id;
        return (
          <section key={subject.id} className="card study-policy-subject-card">
            <button
              type="button"
              className="study-policy-subject-toggle"
              onClick={() => setOpenSubjectId((prev) => (prev === subject.id ? null : subject.id))}
              aria-expanded={isOpen}
            >
              <h3>{subject.name}</h3>
              <span className="study-policy-toggle-icon">{isOpen ? "閉じる ▲" : "見る ▼"}</span>
            </button>

            {isOpen && (
              <>
                <ul className="study-policy-level-list">
                  {policy.levels.map((lv) => (
                    <li key={lv.level} className="study-policy-level-row">
                      <div className="study-policy-level-badge">理解度 {lv.level}</div>
                      <div className="study-policy-level-body">
                        <p className="study-policy-level-achieved">
                          <strong>達成したこと：</strong>
                          {lv.achieved}
                        </p>
                        <p className="study-policy-level-next">
                          <strong>次にやること：</strong>
                          {lv.next}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                {policy.extraNote && (
                  <p className="muted small study-policy-extra-note">{policy.extraNote}</p>
                )}
              </>
            )}
          </section>
        );
      })}

      <button type="button" className="secondary study-policy-back-btn" onClick={onDone}>
        戻る
      </button>
    </div>
  );
}
