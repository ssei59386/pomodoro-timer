interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  description,
  confirmLabel = "実行",
  danger,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 active:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white active:opacity-90 ${
              danger ? "bg-red-500" : "bg-brand-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
