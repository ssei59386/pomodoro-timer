import { useRef, useState } from "react";
import { Download, PlusSquare, Share, Smartphone, Upload } from "lucide-react";
import { exportBackup, importBackup } from "../db";
import ConfirmModal from "../components/ConfirmModal";
import type { BackupPayload } from "../types";

function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.dailyLogs) && Array.isArray(v.exerciseHistory);
}

export default function SettingsScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPayload, setPendingPayload] = useState<BackupPayload | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  async function handleBackup() {
    try {
      const payload = await exportBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = payload.exportedAt.slice(0, 10).replace(/-/g, "");
      a.href = url;
      a.download = `myfitlog-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: "バックアップファイルを書き出しました。" });
    } catch {
      setMessage({ type: "error", text: "バックアップの書き出しに失敗しました。" });
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!isBackupPayload(parsed)) throw new Error("invalid");
        setPendingPayload(parsed);
      } catch {
        setMessage({ type: "error", text: "選択したファイルはバックアップ形式ではありません。" });
      }
    };
    reader.readAsText(file);
  }

  async function confirmRestore() {
    if (!pendingPayload) return;
    try {
      await importBackup(pendingPayload);
      setMessage({ type: "success", text: "データを復元しました。" });
    } catch {
      setMessage({ type: "error", text: "復元に失敗しました。" });
    } finally {
      setPendingPayload(null);
    }
  }

  return (
    <div>
      <header className="px-4 pt-4">
        <h1 className="text-lg font-bold text-brand-800">設定・データ管理</h1>
      </header>

      {message && (
        <p
          className={`mx-4 mt-3 rounded-lg px-3 py-2 text-sm ${
            message.type === "success"
              ? "bg-brand-50 text-brand-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-brand-700">データバックアップ</h2>
        <button
          type="button"
          onClick={handleBackup}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-3 text-sm font-medium text-white active:opacity-90"
        >
          <Download size={16} /> データをバックアップ（JSON出力）
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-300 py-3 text-sm font-medium text-brand-600 active:bg-brand-50"
        >
          <Upload size={16} /> データを復元（JSON読み込み）
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileSelect}
        />
        <p className="mt-2 text-xs text-slate-400">
          復元すると現在端末に保存されているすべてのデータが上書きされます。
        </p>
      </section>

      <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-700">
          <Smartphone size={16} /> ホーム画面への追加方法
        </h2>
        <div className="flex flex-col gap-3 text-sm text-slate-600">
          <div>
            <p className="font-medium text-slate-700">iPhone (Safari)</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Share size={14} /> 共有ボタン →「ホーム画面に追加」を選択
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-700">Android (Chrome)</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <PlusSquare size={14} /> メニュー（⋮） →「ホーム画面に追加」または「アプリをインストール」を選択
            </p>
          </div>
        </div>
      </section>

      <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-2 text-sm font-semibold text-brand-700">このアプリについて</h2>
        <p className="text-xs leading-relaxed text-slate-500">
          MyFitLog はすべてのデータをこの端末内（IndexedDB）に保存する、サーバー不要の完全ローカル動作アプリです。
          オフラインでも利用できます。機種変更やブラウザデータ削除の前には、上記のバックアップ機能で必ずデータを書き出してください。
        </p>
      </section>

      {pendingPayload && (
        <ConfirmModal
          title="データを復元しますか？"
          description={`このファイルには記録 ${pendingPayload.dailyLogs.length}件 が含まれています。現在の端末データはすべて上書きされます。この操作は取り消せません。`}
          confirmLabel="復元する"
          danger
          onConfirm={confirmRestore}
          onCancel={() => setPendingPayload(null)}
        />
      )}
    </div>
  );
}
