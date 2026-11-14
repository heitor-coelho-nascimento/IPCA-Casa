import React, { useEffect, useState } from 'react';
import {
  isGaConfigured,
  syncAnalyticsWithConsent,
} from '../services/analytics';
import {
  CONSENT_CHANGED_EVENT,
  OPEN_COOKIE_MODAL_EVENT,
  getDefaultConsentCategories,
  getEffectiveConsentCategories,
  hasUserMadeConsentChoice,
  saveConsentPreferences,
} from '../services/consent';
import { ConsentPreferenceState } from '../types';

interface AnalyticsConsentBannerProps {
  onOpenPrivacy: () => void;
  authenticatedUserId?: string | null;
}

export const AnalyticsConsentBanner: React.FC<AnalyticsConsentBannerProps> = ({
  onOpenPrivacy,
  authenticatedUserId = null,
}) => {
  const [bannerVisible, setBannerVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  const gaConfigured = isGaConfigured();

  useEffect(() => {
    const refreshFromStorage = () => {
      const current = getEffectiveConsentCategories();
      setAnalyticsEnabled(current.analytics);
      setMarketingEnabled(current.marketing);
      setBannerVisible(!hasUserMadeConsentChoice());
    };

    refreshFromStorage();

    const handleOpenModal = () => {
      const current = getEffectiveConsentCategories();
      setAnalyticsEnabled(current.analytics);
      setMarketingEnabled(current.marketing);
      setModalOpen(true);
    };

    window.addEventListener(OPEN_COOKIE_MODAL_EVENT, handleOpenModal);
    window.addEventListener(CONSENT_CHANGED_EVENT, refreshFromStorage);
    return () => {
      window.removeEventListener(OPEN_COOKIE_MODAL_EVENT, handleOpenModal);
      window.removeEventListener(CONSENT_CHANGED_EVENT, refreshFromStorage);
    };
  }, []);

  const persistConsentDecision = async (
    next: { analytics: boolean; marketing: boolean },
    source: ConsentPreferenceState['source']
  ) => {
    const saved = saveConsentPreferences(next, source);
    syncAnalyticsWithConsent({
      analytics: saved.categories.analytics,
      marketing: saved.categories.marketing,
    });
    setAnalyticsEnabled(saved.categories.analytics);
    setMarketingEnabled(saved.categories.marketing);
    setBannerVisible(false);
    setModalOpen(false);

    if (authenticatedUserId) {
      try {
        const { FirestoreService } = await import('../services/firestore');
        await FirestoreService.recordConsent(authenticatedUserId, {
          id: `consent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          anonymousConsentId: saved.anonymousConsentId,
          essenciais: true,
          analytics: saved.categories.analytics,
          marketing: saved.categories.marketing,
          cmpVersion: saved.cmpVersion,
          policyVersion: saved.version,
          source: saved.source,
          decidedAt: saved.decidedAt,
        });
      } catch {
        // Preferência local continua válida mesmo se escrita remota falhar por rede
      }
    }
  };

  const defaults = getDefaultConsentCategories();

  return (
    <>
      {bannerVisible && !modalOpen && (
        <aside
          aria-label="Preferências de cookies e privacidade"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-lg z-50 bg-[#ffffff] border border-[#dce9ff] rounded-2xl shadow-xl p-4 sm:p-5 flex flex-col gap-3"
        >
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-[#006a61] shrink-0 mt-0.5">
              shield
            </span>
            <div className="text-xs text-[#45464d] leading-relaxed">
              <strong className="text-[#0b1c30] block mb-0.5">
                Privacidade, Cookies e Preferências (LGPD)
              </strong>
              Cookies essenciais mantêm a segurança e sua sessão. Métricas opcionais permanecem desativadas por padrão e nunca coletam salários, gastos em R$ ou e-mail.{' '}
              <a
                href="/privacidade"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenPrivacy();
                }}
                className="text-[#006a61] underline font-medium"
              >
                Política de Privacidade
              </a>
              .
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-[#0b1c30] bg-[#eff4ff] hover:bg-[#dce9ff] transition-colors cursor-pointer"
            >
              Gerenciar preferências
            </button>
            <button
              type="button"
              onClick={() =>
                persistConsentDecision(
                  { analytics: defaults.analytics, marketing: defaults.marketing },
                  'banner'
                )
              }
              className="px-3.5 py-2 rounded-lg border border-[#c6c6cd] bg-[#ffffff] text-[#0b1c30] hover:bg-[#eff4ff] text-xs font-mono font-semibold transition-colors cursor-pointer"
            >
              Recusar opcionais
            </button>
            <button
              type="button"
              onClick={() => persistConsentDecision({ analytics: true, marketing: true }, 'banner')}
              className="px-3.5 py-2 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-colors cursor-pointer"
            >
              Aceitar todos
            </button>
          </div>
        </aside>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cmp-modal-title"
          className="fixed inset-0 bg-[#213145]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-[#ffffff] rounded-2xl max-w-lg w-full shadow-2xl p-6 flex flex-col gap-4 border border-[#eff4ff] max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#eff4ff]">
              <div>
                <h2 id="cmp-modal-title" className="text-base font-bold text-[#0b1c30]">
                  Gerenciar Preferências de Cookies e Privacidade
                </h2>
                <p className="text-xs text-[#45464d] mt-0.5">
                  Controle granular conforme a LGPD. Você pode alterar ou revogar sua escolha a qualquer momento.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar preferências de cookies"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#76777d] hover:bg-[#eff4ff] hover:text-[#0b1c30] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Essenciais */}
              <div className="p-3.5 rounded-xl bg-[#f8f9ff] border border-[#eff4ff] flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0b1c30]">Cookies e Armazenamento Essenciais</span>
                    <span className="px-2 py-0.5 rounded bg-[#eff4ff] text-[#006a61] font-mono text-[10px] font-bold">
                      Sempre ativo
                    </span>
                  </div>
                  <p className="text-[11px] text-[#45464d] mt-1 leading-relaxed">
                    Necessários para autenticação segura no Firebase, isolamento da sessão, roteamento e registro desta preferência de privacidade.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  aria-label="Cookies essenciais sempre ativos"
                  className="mt-1 h-4 w-4 accent-[#006a61]"
                />
              </div>

              {/* Analytics */}
              <label className="p-3.5 rounded-xl bg-[#ffffff] border border-[#dce9ff] flex items-start justify-between gap-3 cursor-pointer hover:bg-[#f8f9ff]">
                <div>
                  <span className="text-xs font-bold text-[#0b1c30] block">
                    Métricas Agregadas (Analytics)
                  </span>
                  <p className="text-[11px] text-[#45464d] mt-1 leading-relaxed">
                    Medição anônima de navegação via Google Analytics 4 com bloqueio estrito de PII e de valores financeiros.{' '}
                    {!gaConfigured && (
                      <span className="font-mono text-[#76777d]">
                        (ID de medição GA4 não configurado nesta implantação.)
                      </span>
                    )}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#006a61] cursor-pointer"
                />
              </label>

              {/* Marketing */}
              <label className="p-3.5 rounded-xl bg-[#ffffff] border border-[#dce9ff] flex items-start justify-between gap-3 cursor-pointer hover:bg-[#f8f9ff]">
                <div>
                  <span className="text-xs font-bold text-[#0b1c30] block">
                    Comunicação e Personalização (Marketing)
                  </span>
                  <p className="text-[11px] text-[#45464d] mt-1 leading-relaxed">
                    Autoriza eventuais tags de atribuição ou campanhas informativas quando ativadas no ambiente. Permanece desativado por padrão.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={marketingEnabled}
                  onChange={(e) => setMarketingEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#006a61] cursor-pointer"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#eff4ff]">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  onOpenPrivacy();
                }}
                className="text-xs text-[#006a61] underline font-medium cursor-pointer"
              >
                Ler Política de Privacidade
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    persistConsentDecision({ analytics: false, marketing: false }, 'modal')
                  }
                  className="px-3 py-2 rounded-lg border border-[#c6c6cd] text-xs font-mono font-semibold text-[#0b1c30] hover:bg-[#eff4ff] cursor-pointer"
                >
                  Recusar opcionais
                </button>
                <button
                  type="button"
                  onClick={() =>
                    persistConsentDecision(
                      { analytics: analyticsEnabled, marketing: marketingEnabled },
                      'modal'
                    )
                  }
                  className="px-3.5 py-2 rounded-lg bg-[#006a61] text-[#ffffff] hover:bg-[#005049] text-xs font-mono font-semibold cursor-pointer"
                >
                  Salvar preferências
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
