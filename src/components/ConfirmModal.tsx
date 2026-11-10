import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-[#ffffff] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#eff4ff] flex flex-col gap-4 animate-scale-in">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDestructive ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#eff4ff] text-[#497cff]'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {isDestructive ? 'warning' : 'help'}
            </span>
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">{title}</h3>
          </div>
        </div>

        <p className="text-xs text-[#45464d] leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#eff4ff]">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-mono font-medium transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-9 px-5 rounded-lg text-xs font-mono font-semibold transition-all shadow-sm cursor-pointer ${
              isDestructive
                ? 'bg-[#ba1a1a] hover:bg-[#93000a] text-[#ffffff]'
                : 'bg-[#000000] hover:bg-[#213145] text-[#ffffff]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
