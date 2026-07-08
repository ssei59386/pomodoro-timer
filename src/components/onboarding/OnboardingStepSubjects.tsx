import { useState } from "react";
import { SUBJECT_TEMPLATES, type SubjectTemplateKey } from "../../data/subjectTemplates";
import { makeDraftSubject, type DraftSubject } from "./onboardingTypes";

/** テンプレート選択の並び順（Settings.tsx の教科追加フォームと揃える） */
const TEMPLATE_KEY_ORDER: SubjectTemplateKey[] = ["math", "science", "english", "social", "japanese"];

interface Props {
  subjects: DraftSubject[];
  onChange: (next: DraftSubject[]) => void;
}

// ステップ0：使う教科を選んで追加する（教科の複数登録対応、段階5）。固定5教科のチェックボックスは
// 廃止し、テンプレート（振る舞い）を選んで教科インスタンスを追加する方式にした。同じテンプレートを
// 複数回追加できる（例：数学I・数学Aを別のテスト日で登録）。あとから設定でも教科を追加・変更できる
// ため（addSubject/removeSubject、段階3）、ここで選び忘れても致命的ではない。
export function OnboardingStepSubjects({ subjects, onChange }: Props) {
  const [newTemplateKey, setNewTemplateKey] = useState<SubjectTemplateKey>("math");
  const [newName, setNewName] = useState(SUBJECT_TEMPLATES.math.defaultName);

  const addSubject = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const draft = makeDraftSubject(newTemplateKey, trimmed);
    onChange([...subjects, draft]);
    setNewName(SUBJECT_TEMPLATES[newTemplateKey].defaultName);
  };

  const renameSubject = (instanceId: string, name: string) => {
    onChange(subjects.map((s) => (s.instanceId === instanceId ? { ...s, name } : s)));
  };

  const removeSubject = (instanceId: string) => {
    onChange(subjects.filter((s) => s.instanceId !== instanceId));
  };

  return (
    <section className="card">
      {subjects.length > 0 && (
        <div className="subject-instance-list">
          {subjects.map((s) => (
            <div key={s.instanceId} className="subject-instance-row">
              <input
                type="text"
                aria-label={`${SUBJECT_TEMPLATES[s.templateKey].defaultName}（教科名を編集）`}
                value={s.name}
                onChange={(e) => renameSubject(s.instanceId, e.target.value)}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`${s.name}を削除`}
                onClick={() => removeSubject(s.instanceId)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="subject-add-form">
        <label className="field">
          <span>テンプレート</span>
          <select
            value={newTemplateKey}
            onChange={(e) => {
              const key = e.target.value as SubjectTemplateKey;
              setNewTemplateKey(key);
              setNewName(SUBJECT_TEMPLATES[key].defaultName);
            }}
          >
            {TEMPLATE_KEY_ORDER.map((key) => (
              <option key={key} value={key}>
                {SUBJECT_TEMPLATES[key].defaultName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>教科名</span>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </label>
        <button type="button" className="secondary" disabled={!newName.trim()} onClick={addSubject}>
          ＋ 教科を追加
        </button>
      </div>
    </section>
  );
}
