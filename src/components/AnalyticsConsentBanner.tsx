import React, { useState, useEffect } from 'react';
import {
  AnalyticsConsentState,
  getConsentStatus,
  isGaConfigured,
  setConsentStatus,
} from '../services/analytics';

interface AnalyticsConsentBannerProps {
  onOpenPrivacy: () => void;
}

export const AnalyticsConsentBanner: React.FC<AnalyticsConsentBannerProps> = ({
  onOpenPrivacy,
}) => {
  const [consent, setConsent] = useState<AnalyticsConsentState | null>('denied');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isGaConfigured()) {
      setVisible(false);
      return;
    }
    const stored = getConsentStatus();
    setConsent(stored);
    setVisible(stored === null);
  }, []);

  if (!visible || consent !== null) {
    return null;
  }

  const handleChoice = (choice: AnalyticsConsentState) => {
    setConsentStatus(choice);
    setConsent(choice);
    setVisible(false);
  };

  return (
    <aside
      aria-label="Preferências de métricas e privacidade"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 bg-[#ffffff] border border-[#dce9ff] rounded-2xl shadow-xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-2.5">
        <span className="material-symbols-outlined text-[20px] text-[#006a61] shrink-0 mt-0.5">
          shield
        </span>
        <div className="text-xs text-[#45464d] leading-relaxed">
          <strong className="text-[#0b1c30] block mb-0.5">Privacidade e Métricas de Uso</strong>
          Usamos Google Analytics apenas para medir navegação agregada sem coletar renda, salários, gastos ou dados pessoais.{' '}
          <a
            href="/privacidade"
            onClick={(e) => {
              e.preventDefault();
              onOpenPrivacy();
            }}
            className="text-[#006a61] underline font-medium"
          >
            Saiba mais
          </a>
          .
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => handleChoice('denied')}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#45464d] hover:bg-[#eff4ff] transition-colors cursor-pointer"
        >
          Recusar
        </button>
        <button
          type="button"
          onClick={() => handleChoice('granted')}
          className="px-3.5 py-1.5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-colors cursor-pointer"
        >
          Permitir métricas anônimas
        </button>
      </div>
    </aside>
  );
};
