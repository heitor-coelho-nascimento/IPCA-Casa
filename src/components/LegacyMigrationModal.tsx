import React, { useState } from 'react';
import { LegacyLocalBundle } from '../services/auth';
import { UserAccount } from '../types';

interface LegacyMigrationModalProps {
  isOpen: boolean;
  bundle: LegacyLocalBundle | null;
  targetUser: UserAccount | null;
  onConfirmMigrate: (bundle: LegacyLocalBundle) => Promise<void>;
  onDiscardLegacy: () => void;
  onPostpone: () => void;
}

export const LegacyMigrationModal: React.FC<LegacyMigrationModalProps> = ({
  isOpen,
  bundle,
  targetUser,
  onConfirmMigrate,
  onDiscardLegacy,
  onPostpone,
}) => {
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  if (!isOpen || !bundle || !targetUser || !bundle.hasFinancialData) return null;

  const handleMigrate = async () => {
    if (!consentChecked || migrating) return;
    setError(null);
    setMigrating(true);
    try {
      await onConfirmMigrate(bundle);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível concluir a gravação no Cloud Firestore. Os registros locais foram preservados intactos.'
      );
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1c30]/60 backdrop-blur-sm p-4">
      <div className="bg-[#ffffff] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#eff4ff] flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#eff4ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#dce9ff] text-[#497cff] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0b1c30]">
                Migração Segura de Registros Locais Antigos
              </h3>
              <span className="text-[11px] font-mono text-[#76777d]">
                Importação mediante consentimento explícito do titular
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={migrating}
            onClick={onPostpone}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#76777d] hover:bg-[#eff4ff] cursor-pointer disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <p className="text-xs text-[#45464d] leading-relaxed">
          Foram encontrados registros financeiros salvos localmente neste navegador (versão anterior sem nuvem). Por segurança e LGPD, eles{' '}
          <strong>nunca são vinculados automaticamente pelo e-mail</strong>.
        </p>

        <div className="p-3.5 bg-[#eff4ff] rounded-xl border border-[#dce9ff] flex flex-col gap-2 text-xs">
          <div className="font-semibold text-[#0b1c30]">
            Conta de destino autenticada no Firebase:
          </div>
          <div className="font-mono text-[#006a61] break-all">
            {targetUser.displayName} • {targetUser.email}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#dce9ff] font-mono text-[11px] text-[#45464d]">
            <span>Perfis: <strong>{bundle.profiles.length}</strong></span>
            <span>Itens cesta: <strong>{bundle.basketItems.length}</strong></span>
            <span>Rendas: <strong>{bundle.incomeHistory.length}</strong></span>
            <span>Cotações: <strong>{bundle.priceHistory.length}</strong></span>
            <span>
              Planos: <strong>{bundle.plansA.length + bundle.plansB.length + bundle.plansC.length}</strong>
            </span>
            <span>Categorias: <strong>{bundle.customGroups.length}</strong></span>
          </div>
        </div>

        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#eff4ff] bg-[#f8f9ff] text-xs text-[#0b1c30] cursor-pointer">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 rounded border-[#c6c6cd] text-[#006a61]"
          />
          <span className="leading-relaxed">
            Confirmo que os registros locais encontrados neste navegador pertencem à conta autenticada acima e autorizo sua gravação na minha área privada do Cloud Firestore (os dados locais só serão limpos após confirmação do envio).
          </span>
        </label>

        {error && (
          <div className="p-3 rounded-xl bg-[#ffdad6]/50 border border-[#ba1a1a]/30 text-xs font-mono text-[#ba1a1a]">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-[#eff4ff]">
          <button
            type="button"
            disabled={migrating}
            onClick={onDiscardLegacy}
            className="h-9 px-3 rounded-lg border border-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffdad6]/30 text-xs font-mono font-medium cursor-pointer disabled:opacity-40"
          >
            Descartar Dados Locais
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={migrating}
              onClick={onPostpone}
              className="h-9 px-3.5 rounded-lg bg-[#eff4ff] text-[#45464d] hover:bg-[#e5eeff] text-xs font-mono font-medium cursor-pointer disabled:opacity-40"
            >
              Decidir Depois
            </button>
            <button
              type="button"
              disabled={!consentChecked || migrating}
              onClick={handleMigrate}
              className="h-9 px-4 rounded-lg bg-[#006a61] text-[#ffffff] hover:bg-[#005049] text-xs font-mono font-semibold cursor-pointer disabled:opacity-40"
            >
              {migrating ? 'Migrando para Nuvem...' : 'Confirmar e Migrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
