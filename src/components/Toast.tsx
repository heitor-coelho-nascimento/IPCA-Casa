import React from 'react';
import { ToastNotification } from '../types';

interface ToastProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const bgColors = {
          success: 'bg-[#006a61] text-[#ffffff] border-[#86f2e4]/40',
          error: 'bg-[#ba1a1a] text-[#ffffff] border-[#ffb4ab]/40',
          info: 'bg-[#0b1c30] text-[#ffffff] border-[#497cff]/40',
        };

        const icons = {
          success: 'check_circle',
          error: 'error',
          info: 'info',
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border text-xs font-mono transition-all duration-300 animate-slide-up ${bgColors[toast.type]}`}
          >
            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
              {icons[toast.type]}
            </span>
            <div className="flex-1 leading-snug">
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-white/70 hover:text-white shrink-0 cursor-pointer ml-1"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
